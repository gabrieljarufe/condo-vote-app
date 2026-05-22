package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.poll.dto.VoteResponse;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.exception.UnprocessableEntityException;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

@ExtendWith(MockitoExtension.class)
class VoteServiceTest {

  @Mock NamedParameterJdbcTemplate namedJdbc;
  @Mock VoteRepository voteRepository;
  @Mock PollCloser pollCloser;
  @Mock AuditEventPublisher auditEventPublisher;

  VoteService voteService;

  UUID pollId = UuidV7.generate();
  UUID condoId = UuidV7.generate();
  UUID apartmentId = UuidV7.generate();
  UUID optionId = UuidV7.generate();
  UUID voterUserId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    voteService = new VoteService(namedJdbc, voteRepository, pollCloser, auditEventPublisher);
  }

  // Helpers para stubbing

  private Map<String, Object> openPollRow() {
    return Map.of(
        "id",
        pollId,
        "condominium_id",
        condoId,
        "status",
        "OPEN",
        "convocation",
        "SECOND",
        "quorum_mode",
        "SIMPLE_MAJORITY",
        "eligible_count",
        5);
  }

  private Map<String, Object> snapshotRow() {
    return Map.of("eligible_voter_user_id", voterUserId);
  }

  private Map<String, Object> optionRow() {
    return Map.of("1", 1);
  }

  private Vote savedVote() {
    return new Vote(
        UuidV7.generate(),
        condoId,
        pollId,
        optionId,
        apartmentId,
        voterUserId,
        OffsetDateTime.now());
  }

  /** Configura stubs para o caminho feliz completo (sem auto-close). */
  private void stubHappyPath(int eligibleCount, long voteCount) {
    Map<String, Object> pollRow =
        Map.of(
            "id",
            pollId,
            "condominium_id",
            condoId,
            "status",
            "OPEN",
            "convocation",
            "SECOND",
            "quorum_mode",
            "SIMPLE_MAJORITY",
            "eligible_count",
            eligibleCount);

    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(pollRow)) // LOCK_POLL
        .thenReturn(List.of(snapshotRow())) // CHECK_ELIGIBILITY
        .thenReturn(List.of(optionRow())) // CHECK_OPTION
        .thenReturn(Collections.emptyList()); // CHECK_DUP

    when(namedJdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(1);

    when(namedJdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class)))
        .thenReturn(voteCount);

    when(voteRepository.findById(any(UUID.class))).thenReturn(Optional.of(savedVote()));
  }

  @Test
  void castVote_happyPath_insereEPublicaAudit() {
    stubHappyPath(5, 3L); // 3 votos, 5 elegíveis → não fecha

    VoteResponse response = voteService.castVote(pollId, apartmentId, optionId, voterUserId, false);

    assertThat(response).isNotNull();
    assertThat(response.pollId()).isEqualTo(pollId);
    assertThat(response.apartmentId()).isEqualTo(apartmentId);

    verify(namedJdbc).update(anyString(), any(SqlParameterSource.class));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
    verify(auditEventPublisher)
        .publish(
            eq("VOTE_CAST"),
            eq("vote"),
            any(UUID.class),
            payloadCaptor.capture(),
            eq(condoId),
            eq(voterUserId));

    Map<String, Object> payload = payloadCaptor.getValue();
    assertThat(payload.get("pollId")).isEqualTo(pollId.toString());
    assertThat(payload.get("apartmentId")).isEqualTo(apartmentId.toString());
    assertThat(payload.get("optionId")).isEqualTo(optionId.toString());
    assertThat(payload.get("voterUserId")).isEqualTo(voterUserId.toString());
    assertThat(payload.get("bulkOperation")).isEqualTo(false);
  }

  @Test
  void castVote_pollNaoEncontrada_lancaNotFound() {
    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(Collections.emptyList());

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Votação não encontrada");
  }

  @Test
  void castVote_pollDraft_lancaConflict() {
    Map<String, Object> draftPollRow =
        Map.of(
            "id",
            pollId,
            "condominium_id",
            condoId,
            "status",
            "DRAFT",
            "convocation",
            "FIRST",
            "quorum_mode",
            "SIMPLE_MAJORITY",
            "eligible_count",
            5);

    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(draftPollRow));

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("DRAFT");
  }

  @Test
  void castVote_pollScheduled_lancaConflict() {
    Map<String, Object> scheduledPollRow =
        Map.of(
            "id",
            pollId,
            "condominium_id",
            condoId,
            "status",
            "SCHEDULED",
            "convocation",
            "FIRST",
            "quorum_mode",
            "SIMPLE_MAJORITY",
            "eligible_count",
            5);

    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(scheduledPollRow));

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("SCHEDULED");
  }

  @Test
  void castVote_pollClosed_lancaConflict() {
    Map<String, Object> closedPollRow =
        Map.of(
            "id",
            pollId,
            "condominium_id",
            condoId,
            "status",
            "CLOSED",
            "convocation",
            "FIRST",
            "quorum_mode",
            "SIMPLE_MAJORITY",
            "eligible_count",
            5);

    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(closedPollRow));

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("CLOSED");
  }

  @Test
  void castVote_aptForaDoSnapshot_lancaForbidden() {
    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(openPollRow())) // LOCK_POLL
        .thenReturn(Collections.emptyList()); // CHECK_ELIGIBILITY → vazio

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("snapshot");
  }

  @Test
  void castVote_userDiferenteDoEligible_lancaForbidden() {
    UUID outroUser = UuidV7.generate();
    Map<String, Object> snapshotDiferente = Map.of("eligible_voter_user_id", outroUser);

    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(openPollRow())) // LOCK_POLL
        .thenReturn(List.of(snapshotDiferente)); // CHECK_ELIGIBILITY → outro user

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("eligible voter");
  }

  @Test
  void castVote_optionDeOutraPoll_lancaUnprocessable() {
    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(openPollRow())) // LOCK_POLL
        .thenReturn(List.of(snapshotRow())) // CHECK_ELIGIBILITY
        .thenReturn(Collections.emptyList()); // CHECK_OPTION → vazio

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(UnprocessableEntityException.class)
        .hasMessageContaining("Opção não pertence");
  }

  @Test
  void castVote_votoDuplicado_lancaConflict() {
    when(namedJdbc.queryForList(anyString(), any(SqlParameterSource.class)))
        .thenReturn(List.of(openPollRow())) // LOCK_POLL
        .thenReturn(List.of(snapshotRow())) // CHECK_ELIGIBILITY
        .thenReturn(List.of(optionRow())) // CHECK_OPTION
        .thenReturn(List.of(Map.of("1", 1))); // CHECK_DUP → já existe

    assertThatThrownBy(
            () -> voteService.castVote(pollId, apartmentId, optionId, voterUserId, false))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("já registrado");
  }

  @Test
  void castVote_ultimoVoto_disparaAutoClose() {
    // eligible_count = 5, count pós-INSERT = 5 → deve fechar
    stubHappyPath(5, 5L);

    voteService.castVote(pollId, apartmentId, optionId, voterUserId, false);

    verify(pollCloser)
        .close(eq(pollId), eq(voterUserId), eq(PollCloser.CloseTrigger.AUTOMATIC_ALL_VOTED));
  }

  @Test
  void castVote_naoEUltimoVoto_naoFechaPoll() {
    // eligible_count = 5, count pós-INSERT = 4 → não deve fechar
    stubHappyPath(5, 4L);

    voteService.castVote(pollId, apartmentId, optionId, voterUserId, false);

    verify(pollCloser, never())
        .close(any(UUID.class), any(UUID.class), any(PollCloser.CloseTrigger.class));
  }
}
