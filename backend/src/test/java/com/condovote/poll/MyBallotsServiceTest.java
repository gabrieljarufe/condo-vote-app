package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
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

/**
 * UT do MyBallotsService — foca em comportamento (branches de sigilo, propagação de params,
 * mapeamento de retorno). NÃO valida o SQL textual: isso é responsabilidade do
 * MyBallotsControllerIT (Testcontainers contra Postgres real). Aqui usamos contains(...) para
 * discriminar entre as 3 queries do service via fragmentos estáveis, o que torna o teste resiliente
 * a reformat/whitespace.
 */
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
  // getMyBallots — branches de STATUSES_THAT_REVEAL_TOTAL + excluded.
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
        .queryForObject(contains("FROM vote"), any(MapSqlParameterSource.class), eq(Long.class));
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
  void getMyBallots_excludedApartments_propagados() {
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
    verify(jdbc)
        .query(
            contains("JOIN apartment a ON a.id = s.apartment_id"),
            paramsCap.capture(),
            any(RowMapper.class));
    MapSqlParameterSource captured = paramsCap.getValue();
    assertThat(captured.getValue("pollId")).isEqualTo(pollId);
    assertThat(captured.getValue("userId")).isEqualTo(userId);
  }

  // =====================================================================
  // getMyPendingPolls — propagação de params + mapeamento.
  // =====================================================================

  @Test
  void getMyPendingPolls_retornaListaMapeada() {
    MyPendingPollResponse expected =
        new MyPendingPollResponse(
            pollId, "Assembleia", OffsetDateTime.parse("2026-06-01T12:00:00Z"), 2L, 5L);
    when(jdbc.query(
            contains("status::text = 'OPEN'"),
            any(MapSqlParameterSource.class),
            any(RowMapper.class)))
        .thenReturn(List.of(expected));

    List<MyPendingPollResponse> out = service.getMyPendingPolls(condoId);

    assertThat(out).containsExactly(expected);
  }

  @Test
  void getMyPendingPolls_propagaCondoIdEUserId() {
    when(jdbc.query(
            contains("status::text = 'OPEN'"),
            any(MapSqlParameterSource.class),
            any(RowMapper.class)))
        .thenReturn(List.of());

    service.getMyPendingPolls(condoId);

    ArgumentCaptor<MapSqlParameterSource> paramsCap =
        ArgumentCaptor.forClass(MapSqlParameterSource.class);
    verify(jdbc)
        .query(contains("status::text = 'OPEN'"), paramsCap.capture(), any(RowMapper.class));
    MapSqlParameterSource captured = paramsCap.getValue();
    assertThat(captured.getValue("condoId")).isEqualTo(condoId);
    assertThat(captured.getValue("userId")).isEqualTo(userId);
  }

  // =====================================================================
  // Stub helpers — discriminam queries por fragmento estável (não SQL completo).
  // =====================================================================

  @SuppressWarnings({"unchecked", "rawtypes"})
  private void stubBallots(List<MyBallotResponse> ballots) {
    // "JOIN apartment a ON a.id = s.apartment_id" só aparece em LIST_MY_BALLOTS
    // (LIST_EXCLUDED_APARTMENTS também referencia poll_eligible_snapshot, mas via NOT EXISTS).
    when(jdbc.query(
            contains("JOIN apartment a ON a.id = s.apartment_id"),
            any(MapSqlParameterSource.class),
            any(RowMapper.class)))
        .thenReturn((List) ballots);
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private void stubExcluded(List<ExcludedApartmentResponse> excluded) {
    when(jdbc.query(
            contains("FROM apartment a"), any(MapSqlParameterSource.class), any(RowMapper.class)))
        .thenReturn((List) excluded);
  }

  private void stubEligibleCount(long count) {
    when(jdbc.queryForObject(
            contains("FROM poll_eligible_snapshot"),
            any(MapSqlParameterSource.class),
            eq(Long.class)))
        .thenReturn(count);
  }

  private void stubStatus(String status) {
    when(jdbc.queryForObject(
            contains("status::text"), any(MapSqlParameterSource.class), eq(String.class)))
        .thenReturn(status);
  }

  private void stubVoteCount(long count) {
    when(jdbc.queryForObject(
            contains("FROM vote"), any(MapSqlParameterSource.class), eq(Long.class)))
        .thenReturn(count);
  }
}
