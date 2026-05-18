package com.condovote.poll;

import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.exception.UnprocessableEntityException;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Encapsula a transição SCHEDULED → OPEN de uma votação.
 *
 * <p>Reutilizado tanto pelo {@link PollService} (abertura manual pelo síndico) quanto pelo job de
 * abertura automática (T7.5).
 *
 * <p>O snapshot de elegibilidade é gerado atomicamente no mesmo UPDATE que muda o status,
 * garantindo que os CHECKs {@code chk_poll_opened} e {@code chk_poll_eligible_count} sejam
 * satisfeitos em uma única operação.
 */
@Component
public class PollOpener {

  private static final String UPDATE_POLL_OPEN =
      """
      UPDATE poll
         SET status             = 'OPEN',
             opened_at          = now(),
             opened_by_user_id  = :actorUserId,
             eligible_count     = :count,
             updated_at         = now()
       WHERE id = :pollId
      """;

  private final PollRepository pollRepository;
  private final PollEligibleSnapshotRepository snapshotRepository;
  private final AuditEventPublisher auditEventPublisher;
  private final NamedParameterJdbcTemplate namedJdbc;

  public PollOpener(
      PollRepository pollRepository,
      PollEligibleSnapshotRepository snapshotRepository,
      AuditEventPublisher auditEventPublisher,
      NamedParameterJdbcTemplate namedJdbc) {
    this.pollRepository = pollRepository;
    this.snapshotRepository = snapshotRepository;
    this.auditEventPublisher = auditEventPublisher;
    this.namedJdbc = namedJdbc;
  }

  /**
   * Abre a votação, gerando snapshot de elegibilidade e atualizando status para OPEN.
   *
   * @param pollId id da votação
   * @param actorUserId usuário que disparou a abertura (síndico ou SystemUser para jobs)
   * @param automatic {@code true} se disparado por job automático; {@code false} se manual
   * @return poll atualizada com status OPEN
   * @throws NotFoundException se a votação não existir
   * @throws ConflictException se a votação não estiver em SCHEDULED
   * @throws UnprocessableEntityException se não houver apartamentos elegíveis
   */
  @Transactional
  public Poll open(UUID pollId, UUID actorUserId, boolean automatic) {
    Poll poll =
        pollRepository
            .findById(pollId)
            .orElseThrow(() -> new NotFoundException("Votação não encontrada"));

    if (!"SCHEDULED".equals(poll.status())) {
      throw new ConflictException(
          "Votação não está agendada (estado atual: " + poll.status() + ")");
    }

    int count = snapshotRepository.insertSnapshotForCondominium(pollId, poll.condominiumId());

    if (count == 0) {
      throw new UnprocessableEntityException("Nenhum apartamento elegível para votação");
    }

    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("pollId", pollId)
            .addValue("actorUserId", actorUserId)
            .addValue("count", count);
    namedJdbc.update(UPDATE_POLL_OPEN, params);

    String eventType = automatic ? "POLL_OPENED_AUTO" : "POLL_OPENED_MANUALLY";
    auditEventPublisher.publish(
        eventType,
        "poll",
        pollId,
        Map.of("snapshotSize", count),
        poll.condominiumId(),
        actorUserId);

    return pollRepository
        .findById(pollId)
        .orElseThrow(() -> new IllegalStateException("Votação não encontrada após abertura"));
  }
}
