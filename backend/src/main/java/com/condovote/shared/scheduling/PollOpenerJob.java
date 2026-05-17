package com.condovote.shared.scheduling;

import com.condovote.poll.PollOpener;
import com.condovote.shared.constants.SystemUser;
import com.condovote.shared.tenant.TenantContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Abre polls SCHEDULED automaticamente ao atingir scheduled_start.
 *
 * <p>Roda a cada 5min. Lista candidatos cross-tenant (sem RLS) e itera setando TenantContext por
 * poll. Cada open() entra em sua própria @Transactional que ativa o SET LOCAL app.current_tenant
 * via TenantTransactionAspect.
 *
 * <p>V1 single-instance: nenhum lock distribuído (alinhado com InvitationExpirerJob e
 * EmailSenderJob). Migrar para ShedLock quando backend escalar para multi-réplica.
 */
@Component
public class PollOpenerJob {

  private static final Logger log = LoggerFactory.getLogger(PollOpenerJob.class);

  private static final String SELECT_CANDIDATES =
      """
      SELECT id, condominium_id
        FROM poll
       WHERE status = 'SCHEDULED'
         AND scheduled_start <= now()
       ORDER BY scheduled_start
       LIMIT 100
      """;

  private final NamedParameterJdbcTemplate jdbc;
  private final PollOpener pollOpener;

  public PollOpenerJob(NamedParameterJdbcTemplate jdbc, PollOpener pollOpener) {
    this.jdbc = jdbc;
    this.pollOpener = pollOpener;
  }

  @Scheduled(fixedDelayString = "${app.poll.opener-job.fixed-delay-ms:300000}") // 5min
  public void openScheduledPolls() {
    List<Map<String, Object>> candidates = jdbc.getJdbcTemplate().queryForList(SELECT_CANDIDATES);
    if (candidates.isEmpty()) {
      return;
    }
    int opened = 0;
    int failed = 0;
    for (Map<String, Object> row : candidates) {
      UUID pollId = (UUID) row.get("id");
      UUID condoId = (UUID) row.get("condominium_id");
      try {
        TenantContext.set(condoId);
        pollOpener.open(pollId, SystemUser.ID, true);
        opened++;
      } catch (Exception e) {
        failed++;
        log.warn(
            "PollOpenerJob falhou ao abrir poll {} (condo {}): {}",
            pollId,
            condoId,
            e.getMessage(),
            e);
      } finally {
        TenantContext.clear();
      }
    }
    log.info("PollOpenerJob: {} abertas, {} falhas", opened, failed);
  }
}
