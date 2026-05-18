package com.condovote.poll;

import com.condovote.auth.AuthGateway;
import com.condovote.poll.dto.CancelPollRequest;
import com.condovote.poll.dto.CreatePollRequest;
import com.condovote.poll.dto.PollDetailResponse;
import com.condovote.poll.dto.PollOptionResponse;
import com.condovote.poll.dto.PollResponse;
import com.condovote.poll.dto.PollResultResponse;
import com.condovote.poll.dto.UpdatePollRequest;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.exception.UnprocessableEntityException;
import com.condovote.shared.tenant.TenantMembershipRepository;
import com.condovote.shared.web.PageResponse;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Serviço de domínio para o ciclo de vida de votações. */
@Service
public class PollService {

  private static final String INSERT_POLL =
      """
      INSERT INTO poll
          (id, condominium_id, title, description, convocation, quorum_mode, status,
           scheduled_start, scheduled_end, created_by_user_id, created_at, updated_at)
      VALUES
          (:id, :condoId, :title, :description, :convocation::convocation_type,
           :quorumMode::quorum_mode, 'DRAFT',
           :scheduledStart, :scheduledEnd, :createdByUserId, now(), now())
      """;

  private static final String INSERT_POLL_OPTION =
      """
      INSERT INTO poll_option (id, poll_id, label, display_order)
      VALUES (:id, :pollId, :label, :displayOrder)
      """;

  private static final String UPDATE_POLL_DRAFT =
      """
      UPDATE poll
         SET title          = :title,
             description    = :description,
             convocation    = :convocation::convocation_type,
             quorum_mode    = :quorumMode::quorum_mode,
             scheduled_start = :scheduledStart,
             scheduled_end   = :scheduledEnd,
             updated_at      = now()
       WHERE id = :pollId
      """;

  private static final String UPDATE_POLL_SCHEDULED =
      """
      UPDATE poll
         SET status     = 'SCHEDULED',
             updated_at = now()
       WHERE id = :pollId
      """;

  private static final String UPDATE_POLL_CANCELLED =
      """
      UPDATE poll
         SET status                = 'CANCELLED',
             cancelled_at          = now(),
             cancellation_reason   = :reason,
             cancelled_by_user_id  = :actorUserId,
             updated_at            = now()
       WHERE id = :pollId
      """;

  private final PollRepository pollRepository;
  private final PollOptionRepository pollOptionRepository;
  private final PollResultRepository pollResultRepository;
  private final PollOpener pollOpener;
  private final PollCloser pollCloser;
  private final TenantMembershipRepository membershipRepository;
  private final AuthGateway authGateway;
  private final AuditEventPublisher auditEventPublisher;
  private final NamedParameterJdbcTemplate namedJdbc;

  public PollService(
      PollRepository pollRepository,
      PollOptionRepository pollOptionRepository,
      PollResultRepository pollResultRepository,
      PollOpener pollOpener,
      PollCloser pollCloser,
      TenantMembershipRepository membershipRepository,
      AuthGateway authGateway,
      AuditEventPublisher auditEventPublisher,
      NamedParameterJdbcTemplate namedJdbc) {
    this.pollRepository = pollRepository;
    this.pollOptionRepository = pollOptionRepository;
    this.pollResultRepository = pollResultRepository;
    this.pollOpener = pollOpener;
    this.pollCloser = pollCloser;
    this.membershipRepository = membershipRepository;
    this.authGateway = authGateway;
    this.auditEventPublisher = auditEventPublisher;
    this.namedJdbc = namedJdbc;
  }

  // --- mutating ---

  /**
   * Cria uma votação em estado DRAFT.
   *
   * @param condoId condomínio alvo
   * @param request dados da votação
   * @return representação resumida da votação criada
   * @throws ForbiddenException se o usuário não for síndico do condomínio
   * @throws IllegalArgumentException se os dados forem inválidos
   */
  @Transactional
  public PollResponse createDraft(UUID condoId, CreatePollRequest request) {
    UUID userId = authGateway.getCurrentUserId();
    requireAdmin(userId, condoId);

    validatePollData(
        request.title(),
        request.options(),
        request.scheduledStart(),
        request.scheduledEnd(),
        request.convocation(),
        request.quorumMode());

    UUID pollId = UuidV7.generate();
    namedJdbc.update(
        INSERT_POLL,
        new MapSqlParameterSource()
            .addValue("id", pollId)
            .addValue("condoId", condoId)
            .addValue("title", request.title().trim())
            .addValue("description", request.description())
            .addValue("convocation", request.convocation())
            .addValue("quorumMode", request.quorumMode())
            .addValue("scheduledStart", request.scheduledStart())
            .addValue("scheduledEnd", request.scheduledEnd())
            .addValue("createdByUserId", userId));

    insertOptions(pollId, request.options());

    auditEventPublisher.publish(
        "POLL_CREATED",
        "poll",
        pollId,
        Map.of(
            "title", request.title().trim(),
            "optionsCount", request.options().size(),
            "convocation", request.convocation(),
            "quorumMode", request.quorumMode()),
        condoId,
        userId);

    Poll saved =
        pollRepository
            .findById(pollId)
            .orElseThrow(() -> new IllegalStateException("Votação recém-inserida não encontrada"));
    return PollResponse.from(saved);
  }

  /**
   * Atualiza votação em estado DRAFT ou SCHEDULED.
   *
   * @param pollId id da votação
   * @param request novos dados
   * @return votação atualizada
   * @throws NotFoundException se a votação não existir
   * @throws ForbiddenException se o usuário não for síndico
   * @throws ConflictException se a votação não estiver em DRAFT ou SCHEDULED
   */
  @Transactional
  public PollResponse updateDraft(UUID pollId, UpdatePollRequest request) {
    Poll poll = requirePoll(pollId);
    UUID userId = authGateway.getCurrentUserId();
    requireAdmin(userId, poll.condominiumId());

    if (!"DRAFT".equals(poll.status()) && !"SCHEDULED".equals(poll.status())) {
      throw new ConflictException("Não é possível editar votação no estado " + poll.status());
    }

    validatePollData(
        request.title(),
        request.options(),
        request.scheduledStart(),
        request.scheduledEnd(),
        request.convocation(),
        request.quorumMode());

    namedJdbc.update(
        UPDATE_POLL_DRAFT,
        new MapSqlParameterSource()
            .addValue("pollId", pollId)
            .addValue("title", request.title().trim())
            .addValue("description", request.description())
            .addValue("convocation", request.convocation())
            .addValue("quorumMode", request.quorumMode())
            .addValue("scheduledStart", request.scheduledStart())
            .addValue("scheduledEnd", request.scheduledEnd()));

    pollOptionRepository.deleteByPollId(pollId);
    insertOptions(pollId, request.options());

    auditEventPublisher.publish(
        "POLL_UPDATED",
        "poll",
        pollId,
        Map.of("newOptionsCount", request.options().size()),
        poll.condominiumId(),
        userId);

    Poll updated =
        pollRepository
            .findById(pollId)
            .orElseThrow(
                () -> new IllegalStateException("Votação não encontrada após atualização"));
    return PollResponse.from(updated);
  }

  /**
   * Publica a votação (DRAFT → SCHEDULED), validando que a data de início é futura.
   *
   * @param pollId id da votação
   * @return votação no estado SCHEDULED
   * @throws NotFoundException se não encontrar
   * @throws ForbiddenException se não for síndico
   * @throws ConflictException se não estiver em DRAFT
   * @throws UnprocessableEntityException se scheduledStart estiver no passado
   */
  @Transactional
  public PollResponse publish(UUID pollId) {
    Poll poll = requirePoll(pollId);
    UUID userId = authGateway.getCurrentUserId();
    requireAdmin(userId, poll.condominiumId());

    if (!"DRAFT".equals(poll.status())) {
      throw new ConflictException("Não é possível publicar votação no estado " + poll.status());
    }

    if (poll.scheduledStart() == null || !poll.scheduledStart().isAfter(OffsetDateTime.now())) {
      throw new UnprocessableEntityException("Data de início no passado");
    }

    namedJdbc.update(UPDATE_POLL_SCHEDULED, new MapSqlParameterSource("pollId", pollId));

    auditEventPublisher.publish(
        "POLL_SCHEDULED",
        "poll",
        pollId,
        Map.of(
            "scheduledStart",
            poll.scheduledStart().toString(),
            "scheduledEnd",
            poll.scheduledEnd() != null ? poll.scheduledEnd().toString() : ""),
        poll.condominiumId(),
        userId);

    Poll updated =
        pollRepository
            .findById(pollId)
            .orElseThrow(() -> new IllegalStateException("Votação não encontrada após publicação"));
    return PollResponse.from(updated);
  }

  /**
   * Abre a votação manualmente (SCHEDULED → OPEN).
   *
   * @param pollId id da votação
   * @return votação no estado OPEN
   * @throws NotFoundException se não encontrar
   * @throws ForbiddenException se não for síndico
   * @throws ConflictException se não estiver em SCHEDULED
   * @throws UnprocessableEntityException se não houver apartamentos elegíveis
   */
  @Transactional
  public PollResponse openManually(UUID pollId) {
    Poll poll = requirePoll(pollId);
    UUID userId = authGateway.getCurrentUserId();
    requireAdmin(userId, poll.condominiumId());

    if (!"SCHEDULED".equals(poll.status())) {
      throw new ConflictException(
          "Votação não está agendada (estado atual: " + poll.status() + ")");
    }

    Poll opened = pollOpener.open(pollId, userId, false);
    return PollResponse.from(opened);
  }

  /**
   * Cancela a votação (DRAFT/SCHEDULED/OPEN → CANCELLED).
   *
   * @param pollId id da votação
   * @param request motivo do cancelamento
   * @return votação cancelada
   * @throws NotFoundException se não encontrar
   * @throws ForbiddenException se não for síndico
   * @throws ConflictException se não puder cancelar no estado atual
   */
  @Transactional
  public PollResponse cancel(UUID pollId, CancelPollRequest request) {
    Poll poll = requirePoll(pollId);
    UUID userId = authGateway.getCurrentUserId();
    requireAdmin(userId, poll.condominiumId());

    String previousStatus = poll.status();
    if (!"DRAFT".equals(previousStatus)
        && !"SCHEDULED".equals(previousStatus)
        && !"OPEN".equals(previousStatus)) {
      throw new ConflictException("Não é possível cancelar votação no estado " + previousStatus);
    }

    namedJdbc.update(
        UPDATE_POLL_CANCELLED,
        new MapSqlParameterSource()
            .addValue("pollId", pollId)
            .addValue("reason", request.reason())
            .addValue("actorUserId", userId));

    auditEventPublisher.publish(
        "POLL_CANCELLED",
        "poll",
        pollId,
        Map.of("reason", request.reason(), "previousStatus", previousStatus),
        poll.condominiumId(),
        userId);

    Poll updated =
        pollRepository
            .findById(pollId)
            .orElseThrow(
                () -> new IllegalStateException("Votação não encontrada após cancelamento"));
    return PollResponse.from(updated);
  }

  /**
   * Encerra a votação manualmente (OPEN → CLOSED ou INVALIDATED).
   *
   * @param pollId id da votação
   * @return votação encerrada
   * @throws NotFoundException se não encontrar
   * @throws ForbiddenException se não for síndico
   * @throws ConflictException se não estiver em OPEN
   */
  @Transactional
  public PollResponse closeManually(UUID pollId) {
    Poll poll = requirePoll(pollId);
    UUID userId = authGateway.getCurrentUserId();
    requireAdmin(userId, poll.condominiumId());

    if (!"OPEN".equals(poll.status())) {
      throw new ConflictException("Votação não está aberta (estado atual: " + poll.status() + ")");
    }

    Poll closed = pollCloser.close(pollId, userId, false);
    return PollResponse.from(closed);
  }

  // --- queries ---

  /**
   * Lista votações de um condomínio com filtro opcional de status e paginação.
   *
   * @param condoId condomínio alvo
   * @param statusFilter status exato (null para todos)
   * @param page página base-0
   * @param size tamanho de página (1..100)
   * @return página de votações
   * @throws ForbiddenException se não for síndico
   * @throws IllegalArgumentException se page/size forem inválidos
   */
  @Transactional(readOnly = true)
  public PageResponse<PollResponse> listByCondominium(
      UUID condoId, String statusFilter, int page, int size) {
    if (page < 0) {
      throw new IllegalArgumentException("page deve ser >= 0");
    }
    if (size < 1 || size > 100) {
      throw new IllegalArgumentException("size deve estar entre 1 e 100");
    }
    UUID userId = authGateway.getCurrentUserId();
    requireMember(userId, condoId);

    int offset = page * size;
    List<PollResponse> content =
        pollRepository
            .findByCondominiumIdFilteredPaged(condoId, statusFilter, size, offset)
            .stream()
            .map(PollResponse::from)
            .toList();
    long total = pollRepository.countByCondominiumIdFiltered(condoId, statusFilter);
    return PageResponse.of(content, page, size, total);
  }

  /**
   * Retorna detalhes completos de uma votação, incluindo opções e resultado (se houver).
   *
   * @param pollId id da votação
   * @return detalhes da votação
   * @throws NotFoundException se não encontrar
   * @throws ForbiddenException se não for síndico
   */
  @Transactional(readOnly = true)
  public PollDetailResponse getById(UUID pollId) {
    Poll poll = requirePoll(pollId);
    UUID userId = authGateway.getCurrentUserId();
    requireMember(userId, poll.condominiumId());

    List<PollOptionResponse> options =
        pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId).stream()
            .map(PollOptionResponse::from)
            .toList();

    Optional<PollResultResponse> result =
        pollResultRepository.findByPollId(pollId).map(PollResultResponse::from);

    return new PollDetailResponse(PollResponse.from(poll), options, result.orElse(null));
  }

  // --- helpers ---

  private Poll requirePoll(UUID pollId) {
    return pollRepository
        .findById(pollId)
        .orElseThrow(() -> new NotFoundException("Votação não encontrada"));
  }

  private void requireAdmin(UUID userId, UUID condoId) {
    if (!membershipRepository.isAdminOfTenant(userId, condoId)) {
      throw new ForbiddenException("Apenas síndicos podem gerenciar votações");
    }
  }

  private void requireMember(UUID userId, UUID condoId) {
    if (!membershipRepository.userBelongsToTenant(userId, condoId)) {
      throw new ForbiddenException("Você não é membro deste condomínio");
    }
  }

  private void validatePollData(
      String title,
      List<String> options,
      OffsetDateTime scheduledStart,
      OffsetDateTime scheduledEnd,
      String convocation,
      String quorumMode) {
    if (title == null || title.isBlank()) {
      throw new IllegalArgumentException("Título da votação é obrigatório");
    }
    if (options == null || options.size() < 2 || options.size() > 10) {
      throw new IllegalArgumentException("A votação deve ter entre 2 e 10 opções");
    }

    // Labels não duplicados (case-insensitive, trim)
    Set<String> uniqueLabels =
        options.stream().map(o -> o.trim().toLowerCase()).collect(Collectors.toSet());
    if (uniqueLabels.size() != options.size()) {
      throw new IllegalArgumentException("As opções da votação não podem ter labels duplicados");
    }

    if (scheduledEnd == null || scheduledStart == null || !scheduledEnd.isAfter(scheduledStart)) {
      throw new IllegalArgumentException(
          "A data de encerramento deve ser posterior à data de início");
    }

    if (!List.of("FIRST", "SECOND").contains(convocation)) {
      throw new IllegalArgumentException("Convocação inválida. Valores aceitos: FIRST, SECOND");
    }

    if (!List.of("SIMPLE_MAJORITY", "ABSOLUTE_MAJORITY", "QUALIFIED_2_3", "QUALIFIED_3_4")
        .contains(quorumMode)) {
      throw new IllegalArgumentException(
          "Modo de quórum inválido. Valores aceitos: SIMPLE_MAJORITY, ABSOLUTE_MAJORITY,"
              + " QUALIFIED_2_3, QUALIFIED_3_4");
    }
  }

  private void insertOptions(UUID pollId, List<String> labels) {
    for (int i = 0; i < labels.size(); i++) {
      namedJdbc.update(
          INSERT_POLL_OPTION,
          new MapSqlParameterSource()
              .addValue("id", UuidV7.generate())
              .addValue("pollId", pollId)
              .addValue("label", labels.get(i).trim())
              .addValue("displayOrder", i));
    }
  }
}
