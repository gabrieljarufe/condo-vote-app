package com.condovote.poll;

import com.condovote.auth.AuthGateway;
import com.condovote.poll.dto.MyBallotResponse;
import com.condovote.poll.dto.MyPendingPollResponse;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MyBallotsController {

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

  private static final String LIST_MY_PENDING =
      """
      SELECT p.id AS poll_id,
             p.title,
             p.scheduled_end,
             COUNT(*) FILTER (WHERE v.id IS NULL) AS pending,
             COUNT(*) AS total
        FROM poll p
        JOIN poll_eligible_snapshot s ON s.poll_id = p.id
   LEFT JOIN vote v ON v.poll_id = s.poll_id AND v.apartment_id = s.apartment_id
       WHERE p.condominium_id = :condoId
         AND p.status::text = 'OPEN'
         AND s.eligible_voter_user_id = :userId
    GROUP BY p.id, p.title, p.scheduled_end
      HAVING COUNT(*) FILTER (WHERE v.id IS NULL) > 0
    ORDER BY p.scheduled_end
      """;

  private final NamedParameterJdbcTemplate jdbc;
  private final AuthGateway authGateway;

  public MyBallotsController(NamedParameterJdbcTemplate jdbc, AuthGateway authGateway) {
    this.jdbc = jdbc;
    this.authGateway = authGateway;
  }

  @GetMapping("/polls/{pollId}/my-ballots")
  public List<MyBallotResponse> myBallots(@PathVariable UUID pollId) {
    UUID userId = authGateway.getCurrentUserId();
    return jdbc.query(
        LIST_MY_BALLOTS,
        new MapSqlParameterSource("pollId", pollId).addValue("userId", userId),
        (rs, i) ->
            new MyBallotResponse(
                (UUID) rs.getObject("apartment_id"),
                rs.getString("label"),
                rs.getBoolean("already_voted"),
                (UUID) rs.getObject("voted_option_id")));
  }

  @GetMapping("/condominiums/{condoId}/my-pending-polls")
  public List<MyPendingPollResponse> myPending(@PathVariable UUID condoId) {
    UUID userId = authGateway.getCurrentUserId();
    return jdbc.query(
        LIST_MY_PENDING,
        new MapSqlParameterSource("condoId", condoId).addValue("userId", userId),
        (rs, i) ->
            new MyPendingPollResponse(
                (UUID) rs.getObject("poll_id"),
                rs.getString("title"),
                rs.getObject("scheduled_end", OffsetDateTime.class),
                rs.getLong("pending"),
                rs.getLong("total")));
  }
}
