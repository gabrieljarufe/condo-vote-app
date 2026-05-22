package com.condovote.shared.scheduling;

import com.condovote.poll.PollCloser;
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
 * Fecha polls OPEN automaticamente ao atingir scheduled_end.
 *
 * <p>Roda a cada 5min. Lista candidatos cross-tenant (sem RLS) e itera setando TenantContext por
 * poll. Cada close() entra em sua própria @Transactional que ativa o SET LOCAL app.current_tenant
 * via TenantTransactionAspect.
 *
 * <p>V1 single-instance: nenhum lock distribuído (alinhado com InvitationExpirerJob e
 * EmailSenderJob). Migrar para ShedLock quando backend escalar para multi-réplica.
 */
@Component
public class PollCloserJob {

  private static final Logger log = LoggerFactory.getLogger(PollCloserJob.class);

  private static final String SELECT_CANDIDATES =
      """
      SELECT id, condominium_id
        FROM poll
       WHERE status = 'OPEN'
         AND scheduled_end <= now()
       ORDER BY scheduled_end
       LIMIT 100
      """;

  private final NamedParameterJdbcTemplate jdbc;
  private final PollCloser pollCloser;

  public PollCloserJob(NamedParameterJdbcTemplate jdbc, PollCloser pollCloser) {
    this.jdbc = jdbc;
    this.pollCloser = pollCloser;
  }

  @Scheduled(fixedDelayString = "${app.poll.closer-job.fixed-delay-ms:300000}") // 5min
  public void closeOpenPolls() {
    List<Map<String, Object>> candidates = jdbc.getJdbcTemplate().queryForList(SELECT_CANDIDATES);
    if (candidates.isEmpty()) {
      return;
    }
    int closed = 0;
    int failed = 0;
    for (Map<String, Object> row : candidates) {
      UUID pollId = (UUID) row.get("id");
      UUID condoId = (UUID) row.get("condominium_id");
      try {
        TenantContext.set(condoId);
        pollCloser.close(pollId, SystemUser.ID, true);
        closed++;
      } catch (Exception e) {
        failed++;
        log.warn(
            "PollCloserJob falhou ao fechar poll {} (condo {}): {}",
            pollId,
            condoId,
            e.getMessage(),
            e);
      } finally {
        TenantContext.clear();
      }
    }
    log.info("PollCloserJob: {} fechadas, {} falhas", closed, failed);
  }
}
