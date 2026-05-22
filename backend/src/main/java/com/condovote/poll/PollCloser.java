package com.condovote.poll;

import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.NotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Encapsula a transição OPEN → CLOSED ou OPEN → INVALIDATED de uma votação.
 *
 * <p>Delega o cálculo do desfecho a {@link PollResultCalculator} (função pura) e persiste o
 * resultado em {@code poll_result}. Reutilizado pelo {@link PollService} (encerramento manual) e
 * pelo job automático de T7.5, e pelo {@link VoteService} (auto-close 100%).
 */
@Component
public class PollCloser {

  /** Origem do encerramento — mapeada diretamente para o enum {@code poll_close_trigger} no DB. */
  public enum CloseTrigger {
    MANUAL,
    AUTOMATIC_END_TIME,
    AUTOMATIC_ALL_VOTED
  }

  private static final String UPDATE_POLL_CLOSE =
      """
      UPDATE poll
         SET status    = :outcome::poll_status,
             closed_at = now(),
             updated_at = now()
       WHERE id = :pollId
      """;

  private static final String INSERT_POLL_RESULT =
      """
      INSERT INTO poll_result
          (poll_id, condominium_id, quorum_denominator, total_votes_computed,
           winning_option_id, quorum_reached, invalidation_reason,
           close_trigger, votes_per_option, computed_at)
      VALUES
          (:pollId, :condoId, :quorumDenominator, :totalVotes,
           :winningOptionId, :quorumReached, :invalidationReason::poll_invalidation_reason,
           :closeTrigger::poll_close_trigger, :votesPerOption::jsonb, now())
      """;

  private static final String COUNT_VOTES_BY_OPTION =
      "SELECT poll_option_id, COUNT(*) AS cnt FROM vote WHERE poll_id = :pollId GROUP BY"
          + " poll_option_id";

  private final PollRepository pollRepository;
  private final PollOptionRepository pollOptionRepository;
  private final PollResultRepository pollResultRepository;
  private final PollResultCalculator calculator;
  private final AuditEventPublisher auditEventPublisher;
  private final NamedParameterJdbcTemplate namedJdbc;
  private final ObjectMapper objectMapper;

  public PollCloser(
      PollRepository pollRepository,
      PollOptionRepository pollOptionRepository,
      PollResultRepository pollResultRepository,
      PollResultCalculator calculator,
      AuditEventPublisher auditEventPublisher,
      NamedParameterJdbcTemplate namedJdbc) {
    this.pollRepository = pollRepository;
    this.pollOptionRepository = pollOptionRepository;
    this.pollResultRepository = pollResultRepository;
    this.calculator = calculator;
    this.auditEventPublisher = auditEventPublisher;
    this.namedJdbc = namedJdbc;
    this.objectMapper = new ObjectMapper();
  }

  /**
   * Fecha a votação, calculando resultado e persistindo em {@code poll_result}.
   *
   * @param pollId id da votação
   * @param actorUserId usuário que disparou o encerramento
   * @param automatic {@code true} se disparado por job; {@code false} se manual
   * @return poll atualizada com status CLOSED ou INVALIDATED
   * @throws NotFoundException se a votação não existir
   * @throws ConflictException se a votação não estiver em OPEN
   * @deprecated Use {@link #close(UUID, UUID, CloseTrigger)} para type-safety no trigger.
   */
  @Transactional
  public Poll close(UUID pollId, UUID actorUserId, boolean automatic) {
    return close(
        pollId, actorUserId, automatic ? CloseTrigger.AUTOMATIC_END_TIME : CloseTrigger.MANUAL);
  }

  /**
   * Fecha a votação com trigger explícito, calculando resultado e persistindo em {@code
   * poll_result}.
   *
   * @param pollId id da votação
   * @param actorUserId usuário que disparou o encerramento
   * @param trigger origem do encerramento (MANUAL, AUTOMATIC_END_TIME, AUTOMATIC_ALL_VOTED)
   * @return poll atualizada com status CLOSED ou INVALIDATED
   * @throws NotFoundException se a votação não existir
   * @throws ConflictException se a votação não estiver em OPEN
   */
  @Transactional
  public Poll close(UUID pollId, UUID actorUserId, CloseTrigger trigger) {
    Poll poll =
        pollRepository
            .findById(pollId)
            .orElseThrow(() -> new NotFoundException("Votação não encontrada"));

    if (!"OPEN".equals(poll.status())) {
      throw new ConflictException("Votação não está aberta (estado atual: " + poll.status() + ")");
    }

    List<PollOption> options = pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId);

    // Contar votos por opção
    Map<UUID, Long> votesByOption = new HashMap<>();
    namedJdbc.query(
        COUNT_VOTES_BY_OPTION,
        new MapSqlParameterSource("pollId", pollId),
        rs -> {
          UUID optionId = (UUID) rs.getObject("poll_option_id");
          long cnt = rs.getLong("cnt");
          votesByOption.put(optionId, cnt);
        });

    // Garantir que opções sem votos apareçam no breakdown com 0
    for (PollOption option : options) {
      votesByOption.putIfAbsent(option.id(), 0L);
    }

    PollResultCalculator.CalculationInput input =
        new PollResultCalculator.CalculationInput(
            poll.convocation(),
            poll.quorumMode(),
            poll.eligibleCount() != null ? poll.eligibleCount() : 0,
            votesByOption);

    PollResultCalculator.CalculationOutput output = calculator.calculate(input);

    String outcomeStatus = output.outcome(); // "CLOSED" ou "INVALIDATED"

    // UPDATE poll
    namedJdbc.update(
        UPDATE_POLL_CLOSE,
        new MapSqlParameterSource().addValue("pollId", pollId).addValue("outcome", outcomeStatus));

    boolean automatic = trigger != CloseTrigger.MANUAL;

    // Calcular quorum_reached
    boolean quorumReached = PollResultCalculator.OUTCOME_CLOSED.equals(outcomeStatus);

    // Serializar votes_per_option como JSONB
    Map<String, Long> votesPerOptionStr = new HashMap<>();
    for (PollResultCalculator.OptionTally tally : output.breakdown()) {
      votesPerOptionStr.put(tally.optionId().toString(), tally.votes());
    }
    String votesPerOptionJson;
    try {
      votesPerOptionJson = objectMapper.writeValueAsString(votesPerOptionStr);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Falha ao serializar votos por opção", e);
    }

    // INSERT poll_result
    namedJdbc.update(
        INSERT_POLL_RESULT,
        new MapSqlParameterSource()
            .addValue("pollId", pollId)
            .addValue("condoId", poll.condominiumId())
            .addValue("quorumDenominator", poll.eligibleCount() != null ? poll.eligibleCount() : 0)
            .addValue("totalVotes", (int) output.totalVotes())
            .addValue("winningOptionId", output.winningOptionId())
            .addValue("quorumReached", quorumReached)
            .addValue(
                "invalidationReason",
                output.invalidationReason() != null ? output.invalidationReason() : null)
            .addValue("closeTrigger", trigger.name())
            .addValue("votesPerOption", votesPerOptionJson));

    // Publicar auditoria
    if (PollResultCalculator.OUTCOME_CLOSED.equals(outcomeStatus)) {
      auditEventPublisher.publish(
          "POLL_CLOSED",
          "poll",
          pollId,
          Map.of(
              "totalVotes",
              output.totalVotes(),
              "winningOptionId",
              output.winningOptionId() != null ? output.winningOptionId().toString() : "",
              "automatic",
              automatic),
          poll.condominiumId(),
          actorUserId);
    } else {
      auditEventPublisher.publish(
          "POLL_INVALIDATED",
          "poll",
          pollId,
          Map.of(
              "totalVotes",
              output.totalVotes(),
              "reason",
              output.invalidationReason() != null ? output.invalidationReason() : "",
              "automatic",
              automatic),
          poll.condominiumId(),
          actorUserId);
    }

    return pollRepository
        .findById(pollId)
        .orElseThrow(() -> new IllegalStateException("Votação não encontrada após encerramento"));
  }
}
