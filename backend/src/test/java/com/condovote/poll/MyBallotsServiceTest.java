package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.auth.AuthGateway;
import com.condovote.poll.dto.ExcludedApartmentResponse;
import com.condovote.poll.dto.MyBallotResponse;
import com.condovote.poll.dto.MyBallotsResponse;
import com.condovote.poll.dto.MyPendingPollResponse;
import com.condovote.shared.UuidV7;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class MyBallotsServiceTest {

  @Mock NamedParameterJdbcTemplate jdbc;
  @Mock AuthGateway authGateway;

  MyBallotsService service;

  UUID userId = UuidV7.generate();
  UUID pollId = UuidV7.generate();
  UUID condoId = UuidV7.generate();
  UUID aptId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    service = new MyBallotsService(jdbc, authGateway);
    when(authGateway.getCurrentUserId()).thenReturn(userId);
  }

  // =====================================================================
  // getMyBallots — cobertura das branches de STATUSES_THAT_REVEAL_TOTAL
  // e do listagem de excluded apartments.
  // =====================================================================

  @Test
  void getMyBallots_pollOpen_naoExpoeTotalVotesSoFar() {
    MyBallotResponse ballot = new MyBallotResponse(aptId, "101", false, null);
    stubBallots(List.of(ballot));
    stubExcluded(List.of());
    stubEligibleCount(5L);
    stubStatus("OPEN");

    MyBallotsResponse out = service.getMyBallots(pollId);

    assertThat(out.totalVotesSoFar()).isNull();
    assertThat(out.eligibleCount()).isEqualTo(5L);
    assertThat(out.ballots()).containsExactly(ballot);
    assertThat(out.excludedApartments()).isEmpty();
    // Nunca conta votos em poll OPEN — sigilo (condo-vote-principles.md §5).
    verify(jdbc, never())
        .queryForObject(
            eq("SELECT COUNT(*) FROM vote WHERE poll_id = :pollId"),
            any(MapSqlParameterSource.class),
            eq(Long.class));
  }

  @Test
  void getMyBallots_pollClosed_revelaTotalVotesSoFar() {
    stubBallots(List.of(new MyBallotResponse(aptId, "101", true, UuidV7.generate())));
    stubExcluded(List.of());
    stubEligibleCount(3L);
    stubStatus("CLOSED");
    stubVoteCount(2L);

    MyBallotsResponse out = service.getMyBallots(pollId);

    assertThat(out.totalVotesSoFar()).isEqualTo(2L);
    assertThat(out.eligibleCount()).isEqualTo(3L);
  }

  @Test
  void getMyBallots_pollInvalidated_revelaTotalVotesSoFar() {
    stubBallots(List.of());
    stubExcluded(List.of());
    stubEligibleCount(3L);
    stubStatus("INVALIDATED");
    stubVoteCount(0L);

    MyBallotsResponse out = service.getMyBallots(pollId);

    assertThat(out.totalVotesSoFar()).isEqualTo(0L);
  }

  @Test
  void getMyBallots_pollCancelled_revelaTotalVotesSoFar() {
    stubBallots(List.of());
    stubExcluded(List.of());
    stubEligibleCount(3L);
    stubStatus("CANCELLED");
    stubVoteCount(1L);

    MyBallotsResponse out = service.getMyBallots(pollId);

    assertThat(out.totalVotesSoFar()).isEqualTo(1L);
  }

  @Test
  void getMyBallots_pollScheduled_naoExpoeTotalVotesSoFar() {
    stubBallots(List.of());
    stubExcluded(List.of());
    stubEligibleCount(3L);
    stubStatus("SCHEDULED");

    MyBallotsResponse out = service.getMyBallots(pollId);

    assertThat(out.totalVotesSoFar()).isNull();
  }

  @Test
  void getMyBallots_excludedApartments_propaganados() {
    ExcludedApartmentResponse excluded =
        new ExcludedApartmentResponse(UuidV7.generate(), "202", "EXCLUDED");
    stubBallots(List.of(new MyBallotResponse(aptId, "101", false, null)));
    stubExcluded(List.of(excluded));
    stubEligibleCount(1L);
    stubStatus("OPEN");

    MyBallotsResponse out = service.getMyBallots(pollId);

    assertThat(out.excludedApartments()).containsExactly(excluded);
  }

  @Test
  void getMyBallots_userIdEPollId_propagadosNasQueries() {
    stubBallots(List.of());
    stubExcluded(List.of());
    stubEligibleCount(0L);
    stubStatus("OPEN");

    service.getMyBallots(pollId);

    ArgumentCaptor<MapSqlParameterSource> paramsCap =
        ArgumentCaptor.forClass(MapSqlParameterSource.class);
    verify(jdbc).query(eq(querySql("LIST_MY_BALLOTS")), paramsCap.capture(), any(RowMapper.class));
    MapSqlParameterSource captured = paramsCap.getValue();
    assertThat(captured.getValue("pollId")).isEqualTo(pollId);
    assertThat(captured.getValue("userId")).isEqualTo(userId);
  }

  // =====================================================================
  // getMyPendingPolls — propagação de params + retorno.
  // =====================================================================

  @Test
  void getMyPendingPolls_retornaListaMapeada() {
    MyPendingPollResponse expected =
        new MyPendingPollResponse(
            pollId, "Assembleia", OffsetDateTime.parse("2026-06-01T12:00:00Z"), 2L, 5L);
    when(jdbc.query(
            eq(querySql("LIST_MY_PENDING")),
            any(MapSqlParameterSource.class),
            any(RowMapper.class)))
        .thenReturn(List.of(expected));

    List<MyPendingPollResponse> out = service.getMyPendingPolls(condoId);

    assertThat(out).containsExactly(expected);
  }

  // =====================================================================
  // Stub helpers — separamos por SQL para isolar branches.
  // =====================================================================

  @SuppressWarnings("unchecked")
  private void stubBallots(List<MyBallotResponse> ballots) {
    when(jdbc.query(
            eq(querySql("LIST_MY_BALLOTS")),
            any(MapSqlParameterSource.class),
            any(RowMapper.class)))
        .thenReturn((List) ballots);
  }

  @SuppressWarnings("unchecked")
  private void stubExcluded(List<ExcludedApartmentResponse> excluded) {
    when(jdbc.query(
            eq(querySql("LIST_EXCLUDED_APARTMENTS")),
            any(MapSqlParameterSource.class),
            any(RowMapper.class)))
        .thenReturn((List) excluded);
  }

  private void stubEligibleCount(long count) {
    when(jdbc.queryForObject(
            eq("SELECT COUNT(*) FROM poll_eligible_snapshot WHERE poll_id = :pollId"),
            any(MapSqlParameterSource.class),
            eq(Long.class)))
        .thenReturn(count);
  }

  private void stubStatus(String status) {
    when(jdbc.queryForObject(
            eq("SELECT status::text FROM poll WHERE id = :pollId"),
            any(MapSqlParameterSource.class),
            eq(String.class)))
        .thenReturn(status);
  }

  private void stubVoteCount(long count) {
    when(jdbc.queryForObject(
            eq("SELECT COUNT(*) FROM vote WHERE poll_id = :pollId"),
            any(MapSqlParameterSource.class),
            eq(Long.class)))
        .thenReturn(count);
  }

  // Replica os literais textuais do service para casar o stub com a chamada.
  // Mantemos como helper para falhar de forma óbvia se o SQL mudar.
  private String querySql(String name) {
    return switch (name) {
      case "LIST_MY_BALLOTS" ->
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
           ORDER BY COALESCE(a.block, ''),
                    NULLIF(SUBSTRING(a.unit_number FROM '^[0-9]+'), '')::int NULLS LAST,
                    a.unit_number
          """;
      case "LIST_EXCLUDED_APARTMENTS" ->
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
           ORDER BY COALESCE(a.block, ''),
                    NULLIF(SUBSTRING(a.unit_number FROM '^[0-9]+'), '')::int NULLS LAST,
                    a.unit_number
          """;
      case "LIST_MY_PENDING" ->
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
      default -> throw new IllegalArgumentException("Unknown query name: " + name);
    };
  }
}
