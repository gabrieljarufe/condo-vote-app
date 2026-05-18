package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.auth.AuthGateway;
import com.condovote.poll.dto.CancelPollRequest;
import com.condovote.poll.dto.CreatePollRequest;
import com.condovote.poll.dto.PollDetailResponse;
import com.condovote.poll.dto.PollResponse;
import com.condovote.poll.dto.UpdatePollRequest;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.UnprocessableEntityException;
import com.condovote.shared.tenant.TenantMembershipRepository;
import com.condovote.shared.web.PageResponse;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class PollServiceTest {

  @Mock PollRepository pollRepository;
  @Mock PollOptionRepository pollOptionRepository;
  @Mock PollResultRepository pollResultRepository;
  @Mock PollOpener pollOpener;
  @Mock PollCloser pollCloser;
  @Mock TenantMembershipRepository membershipRepository;
  @Mock AuthGateway authGateway;
  @Mock AuditEventPublisher auditEventPublisher;
  @Mock NamedParameterJdbcTemplate namedJdbc;

  PollService service;

  UUID userId = UuidV7.generate();
  UUID condoId = UuidV7.generate();
  UUID pollId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    service =
        new PollService(
            pollRepository,
            pollOptionRepository,
            pollResultRepository,
            pollOpener,
            pollCloser,
            membershipRepository,
            authGateway,
            auditEventPublisher,
            namedJdbc);
    lenient().when(authGateway.getCurrentUserId()).thenReturn(userId);
    lenient().when(namedJdbc.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);
  }

  // --- helpers ---

  private Poll draftPoll() {
    return new Poll(
        pollId,
        condoId,
        "Assembleia Geral",
        null,
        "FIRST",
        "SIMPLE_MAJORITY",
        "DRAFT",
        OffsetDateTime.now().plusDays(1),
        OffsetDateTime.now().plusDays(2),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        userId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private Poll scheduledPoll() {
    return new Poll(
        pollId,
        condoId,
        "Assembleia Geral",
        null,
        "FIRST",
        "SIMPLE_MAJORITY",
        "SCHEDULED",
        OffsetDateTime.now().plusDays(1),
        OffsetDateTime.now().plusDays(2),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        userId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private Poll openPoll() {
    return new Poll(
        pollId,
        condoId,
        "Assembleia Geral",
        null,
        "FIRST",
        "SIMPLE_MAJORITY",
        "OPEN",
        OffsetDateTime.now().minusHours(1),
        OffsetDateTime.now().plusHours(2),
        OffsetDateTime.now().minusHours(1),
        userId,
        10,
        null,
        null,
        null,
        null,
        null,
        userId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private Poll closedPoll() {
    return new Poll(
        pollId,
        condoId,
        "Assembleia Geral",
        null,
        "FIRST",
        "SIMPLE_MAJORITY",
        "CLOSED",
        OffsetDateTime.now().minusHours(2),
        OffsetDateTime.now().minusHours(1),
        OffsetDateTime.now().minusHours(2),
        userId,
        10,
        OffsetDateTime.now(),
        null,
        null,
        null,
        null,
        userId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private CreatePollRequest validCreate() {
    return new CreatePollRequest(
        "Assembleia Geral",
        "Descrição",
        "FIRST",
        "SIMPLE_MAJORITY",
        OffsetDateTime.now().plusDays(1),
        OffsetDateTime.now().plusDays(2),
        List.of("Sim", "Não"));
  }

  private UpdatePollRequest validUpdate() {
    return new UpdatePollRequest(
        "Assembleia Geral Atualizada",
        null,
        "SECOND",
        "ABSOLUTE_MAJORITY",
        OffsetDateTime.now().plusDays(3),
        OffsetDateTime.now().plusDays(4),
        List.of("Aprovar", "Rejeitar", "Abstençao"));
  }

  // --- createDraft ---

  @Test
  void createDraft_adminCria_retornaPollDraft() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(pollRepository.findById(any())).thenReturn(Optional.of(draftPoll()));

    PollResponse result = service.createDraft(condoId, validCreate());

    assertThat(result.status()).isEqualTo("DRAFT");
    assertThat(result.title()).isEqualTo("Assembleia Geral");
    verify(auditEventPublisher)
        .publish(eq("POLL_CREATED"), eq("poll"), any(), any(), eq(condoId), eq(userId));
  }

  @Test
  void createDraft_naoAdmin_lancaForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(() -> service.createDraft(condoId, validCreate()))
        .isInstanceOf(ForbiddenException.class);
    verify(namedJdbc, never()).update(anyString(), any(MapSqlParameterSource.class));
  }

  @Test
  void createDraft_labelsDuplicados_lancaIllegalArgument() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    CreatePollRequest req =
        new CreatePollRequest(
            "Assembleia",
            null,
            "FIRST",
            "SIMPLE_MAJORITY",
            OffsetDateTime.now().plusDays(1),
            OffsetDateTime.now().plusDays(2),
            List.of("Sim", "sim")); // duplicado case-insensitive

    assertThatThrownBy(() -> service.createDraft(condoId, req))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("duplicados");
  }

  @Test
  void createDraft_datasInvalidas_lancaIllegalArgument() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    CreatePollRequest req =
        new CreatePollRequest(
            "Assembleia",
            null,
            "FIRST",
            "SIMPLE_MAJORITY",
            OffsetDateTime.now().plusDays(2),
            OffsetDateTime.now().plusDays(1), // end < start
            List.of("Sim", "Não"));

    assertThatThrownBy(() -> service.createDraft(condoId, req))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("encerramento");
  }

  @Test
  void createDraft_convocacaoInvalida_lancaIllegalArgument() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    CreatePollRequest req =
        new CreatePollRequest(
            "Assembleia",
            null,
            "THIRD", // inválido
            "SIMPLE_MAJORITY",
            OffsetDateTime.now().plusDays(1),
            OffsetDateTime.now().plusDays(2),
            List.of("Sim", "Não"));

    assertThatThrownBy(() -> service.createDraft(condoId, req))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // --- updateDraft ---

  @Test
  void updateDraft_emDraft_atualizaEAudit() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    PollResponse result = service.updateDraft(pollId, validUpdate());

    assertThat(result).isNotNull();
    verify(pollOptionRepository).deleteByPollId(pollId);
    verify(auditEventPublisher)
        .publish(eq("POLL_UPDATED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(userId));
  }

  @Test
  void updateDraft_emScheduled_permitido() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(scheduledPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    service.updateDraft(pollId, validUpdate());

    verify(pollOptionRepository).deleteByPollId(pollId);
  }

  @Test
  void updateDraft_emOpen_lancaConflict() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(openPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.updateDraft(pollId, validUpdate()))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("OPEN");
  }

  // --- publish ---

  @Test
  void publish_draftComDataFutura_retornaScheduled() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    Poll scheduled = scheduledPoll();
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(draftPoll()))
        .thenReturn(Optional.of(scheduled));

    PollResponse result = service.publish(pollId);

    assertThat(result.status()).isEqualTo("SCHEDULED");
    verify(auditEventPublisher)
        .publish(eq("POLL_SCHEDULED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(userId));
  }

  @Test
  void publish_draftComDataPassada_lancaUnprocessable() {
    Poll draftPastStart =
        new Poll(
            pollId,
            condoId,
            "Assembleia",
            null,
            "FIRST",
            "SIMPLE_MAJORITY",
            "DRAFT",
            OffsetDateTime.now().minusDays(1), // passado
            OffsetDateTime.now().plusDays(1),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            userId,
            OffsetDateTime.now(),
            OffsetDateTime.now());
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPastStart));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.publish(pollId))
        .isInstanceOf(UnprocessableEntityException.class)
        .hasMessageContaining("passado");
  }

  @Test
  void publish_emOpen_lancaConflict() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(openPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.publish(pollId))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("OPEN");
  }

  // --- openManually ---

  @Test
  void openManually_scheduled_delegaParaOpener() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(scheduledPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(pollOpener.open(pollId, userId, false)).thenReturn(openPoll());

    PollResponse result = service.openManually(pollId);

    assertThat(result.status()).isEqualTo("OPEN");
    verify(pollOpener).open(pollId, userId, false);
  }

  @Test
  void openManually_draft_lancaConflict() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.openManually(pollId))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("DRAFT");
  }

  // --- cancel ---

  @Test
  void cancel_emDraft_cancela() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    Poll cancelled =
        new Poll(
            pollId,
            condoId,
            "Assembleia",
            null,
            "FIRST",
            "SIMPLE_MAJORITY",
            "CANCELLED",
            OffsetDateTime.now().plusDays(1),
            OffsetDateTime.now().plusDays(2),
            null,
            null,
            null,
            null,
            OffsetDateTime.now(),
            "motivo valido aqui",
            userId,
            null,
            userId,
            OffsetDateTime.now(),
            OffsetDateTime.now());
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(draftPoll()))
        .thenReturn(Optional.of(cancelled));

    PollResponse result = service.cancel(pollId, new CancelPollRequest("motivo valido aqui"));

    assertThat(result.status()).isEqualTo("CANCELLED");
    verify(auditEventPublisher)
        .publish(eq("POLL_CANCELLED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(userId));
  }

  @Test
  void cancel_emScheduled_cancela() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(scheduledPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    service.cancel(pollId, new CancelPollRequest("motivo de cancelamento valido"));

    verify(auditEventPublisher)
        .publish(eq("POLL_CANCELLED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(userId));
  }

  @Test
  void cancel_emOpen_cancela() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(openPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    service.cancel(pollId, new CancelPollRequest("cancelar enquanto aberta motivo"));

    verify(auditEventPublisher)
        .publish(eq("POLL_CANCELLED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(userId));
  }

  @Test
  void cancel_emClosed_lancaConflict() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.cancel(pollId, new CancelPollRequest("motivo qualquer longo")))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("CLOSED");
  }

  @Test
  void cancel_auditContemReasonEPreviousStatus() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(scheduledPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    service.cancel(pollId, new CancelPollRequest("motivo explicito e longo aqui"));

    verify(auditEventPublisher)
        .publish(eq("POLL_CANCELLED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(userId));
  }

  // --- closeManually ---

  @Test
  void closeManually_open_delegaParaCloser() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(openPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(pollCloser.close(pollId, userId, false)).thenReturn(closedPoll());

    PollResponse result = service.closeManually(pollId);

    assertThat(result.status()).isEqualTo("CLOSED");
    verify(pollCloser).close(pollId, userId, false);
  }

  @Test
  void closeManually_draft_lancaConflict() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.closeManually(pollId)).isInstanceOf(ConflictException.class);
  }

  // --- listByCondominium ---

  @Test
  void listByCondominium_adminLista_retornaPagina() {
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(true);
    when(pollRepository.findByCondominiumIdFilteredPaged(condoId, null, 20, 0))
        .thenReturn(List.of(draftPoll()));
    when(pollRepository.countByCondominiumIdFiltered(condoId, null)).thenReturn(1L);

    PageResponse<PollResponse> result = service.listByCondominium(condoId, null, 0, 20);

    assertThat(result.content()).hasSize(1);
    assertThat(result.totalElements()).isEqualTo(1L);
  }

  @Test
  void listByCondominium_comFiltroStatus_passaFiltroAoRepository() {
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(true);
    when(pollRepository.findByCondominiumIdFilteredPaged(condoId, "OPEN", 10, 0))
        .thenReturn(List.of(openPoll()));
    when(pollRepository.countByCondominiumIdFiltered(condoId, "OPEN")).thenReturn(1L);

    PageResponse<PollResponse> result = service.listByCondominium(condoId, "OPEN", 0, 10);

    assertThat(result.content()).hasSize(1);
    assertThat(result.content().get(0).status()).isEqualTo("OPEN");
  }

  @Test
  void listByCondominium_naoMembro_lancaForbidden() {
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(() -> service.listByCondominium(condoId, null, 0, 20))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void listByCondominium_residenteNaoAdmin_retornaPagina() {
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(true);
    when(pollRepository.findByCondominiumIdFilteredPaged(condoId, null, 20, 0))
        .thenReturn(List.of(draftPoll()));
    when(pollRepository.countByCondominiumIdFiltered(condoId, null)).thenReturn(1L);

    PageResponse<PollResponse> result = service.listByCondominium(condoId, null, 0, 20);

    assertThat(result.content()).hasSize(1);
    assertThat(result.totalElements()).isEqualTo(1L);
  }

  @Test
  void listByCondominium_pageNegativa_lancaIllegalArgument() {
    assertThatThrownBy(() -> service.listByCondominium(condoId, null, -1, 20))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void listByCondominium_sizeForaDoIntervalo_lancaIllegalArgument() {
    assertThatThrownBy(() -> service.listByCondominium(condoId, null, 0, 0))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.listByCondominium(condoId, null, 0, 101))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // --- getById ---

  @Test
  void getById_pollExiste_retornaDetalhe() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(true);
    when(pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId))
        .thenReturn(List.of(new PollOption(UuidV7.generate(), pollId, "Sim", 0)));
    when(pollResultRepository.findByPollId(pollId)).thenReturn(Optional.empty());

    PollDetailResponse result = service.getById(pollId);

    assertThat(result.poll()).isNotNull();
    assertThat(result.options()).hasSize(1);
    assertThat(result.result()).isNull();
  }

  @Test
  void getById_residenteNaoAdmin_retornaDetalhe() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(true);
    when(pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId))
        .thenReturn(List.of(new PollOption(UuidV7.generate(), pollId, "Sim", 0)));
    when(pollResultRepository.findByPollId(pollId)).thenReturn(Optional.empty());

    PollDetailResponse result = service.getById(pollId);

    assertThat(result.poll()).isNotNull();
    assertThat(result.options()).hasSize(1);
  }

  @Test
  void getById_comResultado_incluiResult() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll()));
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(true);
    when(pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId)).thenReturn(List.of());
    UUID optId = UuidV7.generate();
    PollResult pr =
        new PollResult(
            pollId,
            condoId,
            10,
            8,
            optId,
            true,
            null,
            "AUTOMATIC_END_TIME",
            "{}",
            OffsetDateTime.now());
    when(pollResultRepository.findByPollId(pollId)).thenReturn(Optional.of(pr));

    PollDetailResponse result = service.getById(pollId);

    assertThat(result.result()).isNotNull();
    assertThat(result.result().winningOptionId()).isEqualTo(optId);
  }

  @Test
  void getById_naoMembro_lancaForbidden() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draftPoll()));
    when(membershipRepository.userBelongsToTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(() -> service.getById(pollId)).isInstanceOf(ForbiddenException.class);
  }
}
