package com.condovote.poll;

import com.condovote.poll.dto.VoteResponse;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.exception.UnprocessableEntityException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serviço de domínio para registro de votos.
 *
 * <p>Implementa o fluxo transacional completo do POST /vote:
 *
 * <ol>
 *   <li>Lock pessimista na poll (SELECT ... FOR UPDATE)
 *   <li>Validações de elegibilidade, duplicidade e pertencimento da opção
 *   <li>INSERT do voto (imutável — sem UPDATE/DELETE conforme Código Civil)
 *   <li>Publicação de auditoria VOTE_CAST
 *   <li>Auto-close quando todos os elegíveis já votaram (AUTOMATIC_ALL_VOTED)
 * </ol>
 */
@Service
public class VoteService {

  private static final String LOCK_POLL =
      "SELECT id, condominium_id, status, convocation, quorum_mode, eligible_count "
          + "FROM poll WHERE id = :pollId FOR UPDATE";

  private static final String INSERT_VOTE =
      "INSERT INTO vote (id, condominium_id, poll_id, poll_option_id, apartment_id, voter_user_id,"
          + " voted_at) VALUES (:id, :condoId, :pollId, :optionId, :aptId, :voterUserId, now())";

  private static final String CHECK_ELIGIBILITY =
      "SELECT eligible_voter_user_id FROM poll_eligible_snapshot "
          + "WHERE poll_id = :pollId AND apartment_id = :aptId";

  private static final String CHECK_OPTION =
      "SELECT 1 FROM poll_option WHERE id = :optionId AND poll_id = :pollId";

  private static final String CHECK_DUP =
      "SELECT 1 FROM vote WHERE poll_id = :pollId AND apartment_id = :aptId";

  private static final String COUNT_VOTES = "SELECT COUNT(*) FROM vote WHERE poll_id = :pollId";

  private final NamedParameterJdbcTemplate namedJdbc;
  private final VoteRepository voteRepository;
  private final PollCloser pollCloser;
  private final AuditEventPublisher auditEventPublisher;

  public VoteService(
      NamedParameterJdbcTemplate namedJdbc,
      VoteRepository voteRepository,
      PollCloser pollCloser,
      AuditEventPublisher auditEventPublisher) {
    this.namedJdbc = namedJdbc;
    this.voteRepository = voteRepository;
    this.pollCloser = pollCloser;
    this.auditEventPublisher = auditEventPublisher;
  }

  /**
   * Registra o voto de um apartamento em uma votação aberta.
   *
   * @param pollId id da votação
   * @param apartmentId id do apartamento votante
   * @param optionId id da opção escolhida
   * @param voterUserId id do usuário que está registrando o voto (testemunha de auditoria)
   * @param bulkOperation {@code true} se disparado em lote pelo síndico
   * @return representação do voto registrado
   * @throws NotFoundException se a votação não existir
   * @throws ConflictException se a votação não estiver OPEN ou o apartamento já tiver votado
   * @throws ForbiddenException se o apartamento não estiver no snapshot ou o usuário não for o
   *     eligible_voter
   * @throws UnprocessableEntityException se a opção não pertencer a esta votação
   */
  @Transactional
  public VoteResponse castVote(
      UUID pollId, UUID apartmentId, UUID optionId, UUID voterUserId, boolean bulkOperation) {

    // 1. Lock pessimista — garante serialização contra double-submit e race de auto-close
    var pollParams = new MapSqlParameterSource("pollId", pollId);
    var pollRows = namedJdbc.queryForList(LOCK_POLL, pollParams);
    if (pollRows.isEmpty()) {
      throw new NotFoundException("Votação não encontrada");
    }
    var pollRow = pollRows.get(0);

    String status = (String) pollRow.get("status");
    UUID condoId = (UUID) pollRow.get("condominium_id");
    Integer eligibleCount = (Integer) pollRow.get("eligible_count");

    // 2. Poll deve estar OPEN
    if (!"OPEN".equals(status)) {
      throw new ConflictException("Votação não está aberta (estado atual: " + status + ")");
    }

    // 3. Verificar snapshot de elegibilidade
    var snapshotParams =
        new MapSqlParameterSource().addValue("pollId", pollId).addValue("aptId", apartmentId);
    List<Map<String, Object>> snapshotRows =
        namedJdbc.queryForList(CHECK_ELIGIBILITY, snapshotParams);
    if (snapshotRows.isEmpty()) {
      throw new ForbiddenException(
          "Apartamento não está no snapshot de elegibilidade desta votação");
    }
    UUID eligibleVoterUserId = (UUID) snapshotRows.get(0).get("eligible_voter_user_id");
    if (!voterUserId.equals(eligibleVoterUserId)) {
      throw new ForbiddenException(
          "Usuário não é o eligible voter registrado para este apartamento nesta votação");
    }

    // 4. Verificar que a opção pertence a esta poll
    var optionParams =
        new MapSqlParameterSource().addValue("optionId", optionId).addValue("pollId", pollId);
    List<Map<String, Object>> optionRows = namedJdbc.queryForList(CHECK_OPTION, optionParams);
    if (optionRows.isEmpty()) {
      throw new UnprocessableEntityException("Opção não pertence a esta votação");
    }

    // 5. Verificar duplicidade de voto por apartamento
    var dupParams =
        new MapSqlParameterSource().addValue("pollId", pollId).addValue("aptId", apartmentId);
    List<Map<String, Object>> dupRows = namedJdbc.queryForList(CHECK_DUP, dupParams);
    if (!dupRows.isEmpty()) {
      throw new ConflictException("Voto já registrado para este apartamento nesta votação");
    }

    // 6. INSERT do voto (imutável)
    UUID voteId = UuidV7.generate();
    namedJdbc.update(
        INSERT_VOTE,
        new MapSqlParameterSource()
            .addValue("id", voteId)
            .addValue("condoId", condoId)
            .addValue("pollId", pollId)
            .addValue("optionId", optionId)
            .addValue("aptId", apartmentId)
            .addValue("voterUserId", voterUserId));

    // 7. Publicar auditoria VOTE_CAST
    auditEventPublisher.publish(
        "VOTE_CAST",
        "vote",
        voteId,
        Map.of(
            "pollId", pollId.toString(),
            "apartmentId", apartmentId.toString(),
            "optionId", optionId.toString(),
            "voterUserId", voterUserId.toString(),
            "bulkOperation", bulkOperation),
        condoId,
        voterUserId);

    // 8. Contar votos após inserção
    Long voteCount =
        namedJdbc.queryForObject(
            COUNT_VOTES, new MapSqlParameterSource("pollId", pollId), Long.class);

    // 9. Auto-close se todos os elegíveis já votaram
    if (voteCount != null && eligibleCount != null && voteCount >= eligibleCount) {
      pollCloser.close(pollId, voterUserId, PollCloser.CloseTrigger.AUTOMATIC_ALL_VOTED);
    }

    // 10. Retornar o voto registrado
    Vote vote =
        voteRepository
            .findById(voteId)
            .orElseThrow(() -> new IllegalStateException("Voto não encontrado após inserção"));
    return VoteResponse.from(vote);
  }
}
