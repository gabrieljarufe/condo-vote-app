package com.condovote.poll;

import com.condovote.auth.AuthGateway;
import com.condovote.poll.dto.ExcludedApartmentResponse;
import com.condovote.poll.dto.MyBallotResponse;
import com.condovote.poll.dto.MyBallotsResponse;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MyBallotsService {

  private static final String LIST_MY_BALLOTS =
      """
      SELECT s.apartment_id,
             TRIM(COALESCE(NULLIF(a.block, ''), '') || ' ' || a.unit_number) AS label,
             (v.id IS NOT NULL) AS already_voted,
             v.poll_option_id AS voted_option_id
        FROM poll_eligible_snapshot s
        JOIN apartment a ON a.id = s.apartment_id
   LEFT JOIN vote v ON v.poll_id = s.poll_id AND v.apartment_id = s.apartment_id
       WHERE s.poll_id = :pollId
         AND s.eligible_voter_user_id = :userId
       ORDER BY label
      """;

  private static final String LIST_EXCLUDED_APARTMENTS =
      """
      SELECT a.id AS apartment_id,
             TRIM(COALESCE(NULLIF(a.block, ''), '') || ' ' || a.unit_number) AS label
        FROM apartment a
        JOIN poll p ON p.id = :pollId
       WHERE a.condominium_id = p.condominium_id
         AND a.eligible_voter_user_id = :userId
         AND NOT EXISTS (
             SELECT 1 FROM poll_eligible_snapshot s
              WHERE s.poll_id = :pollId AND s.apartment_id = a.id
         )
       ORDER BY label
      """;

  private static final String COUNT_ELIGIBLE =
      "SELECT COUNT(*) FROM poll_eligible_snapshot WHERE poll_id = :pollId";

  private static final String COUNT_VOTES = "SELECT COUNT(*) FROM vote WHERE poll_id = :pollId";

  private static final String FETCH_POLL_STATUS =
      "SELECT status::text FROM poll WHERE id = :pollId";

  // Voto é sigiloso enquanto a votação está em andamento (condo-vote-principles.md §5).
  // Só expomos o total de votos após o encerramento — antes disso, retornamos null.
  private static final Set<String> STATUSES_THAT_REVEAL_TOTAL =
      Set.of("CLOSED", "INVALIDATED", "CANCELLED");

  private final NamedParameterJdbcTemplate jdbc;
  private final AuthGateway authGateway;

  public MyBallotsService(NamedParameterJdbcTemplate jdbc, AuthGateway authGateway) {
    this.jdbc = jdbc;
    this.authGateway = authGateway;
  }

  @Transactional(readOnly = true)
  public MyBallotsResponse getMyBallots(UUID pollId) {
    UUID userId = authGateway.getCurrentUserId();
    MapSqlParameterSource params =
        new MapSqlParameterSource("pollId", pollId).addValue("userId", userId);

    List<MyBallotResponse> ballots =
        jdbc.query(
            LIST_MY_BALLOTS,
            params,
            (rs, i) ->
                new MyBallotResponse(
                    (UUID) rs.getObject("apartment_id"),
                    rs.getString("label"),
                    rs.getBoolean("already_voted"),
                    (UUID) rs.getObject("voted_option_id")));

    List<ExcludedApartmentResponse> excluded =
        jdbc.query(
            LIST_EXCLUDED_APARTMENTS,
            params,
            (rs, i) ->
                new ExcludedApartmentResponse(
                    (UUID) rs.getObject("apartment_id"), rs.getString("label"), "EXCLUDED"));

    MapSqlParameterSource pollOnly = new MapSqlParameterSource("pollId", pollId);
    long eligibleCount = jdbc.queryForObject(COUNT_ELIGIBLE, pollOnly, Long.class);

    String status = jdbc.queryForObject(FETCH_POLL_STATUS, pollOnly, String.class);
    Long totalVotesSoFar =
        STATUSES_THAT_REVEAL_TOTAL.contains(status)
            ? jdbc.queryForObject(COUNT_VOTES, pollOnly, Long.class)
            : null;

    return new MyBallotsResponse(ballots, excluded, totalVotesSoFar, eligibleCount);
  }
}
