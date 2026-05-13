package com.condovote.shared.scheduling;

import com.condovote.invitation.InvitationRepository;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Job de manutenção: marca convites PENDING expirados como EXPIRED.
 *
 * <p>Roda a cada 1h. Idempotente — o UPDATE filtra por {@code status='PENDING' AND expires_at <
 * now()}, logo execuções concorrentes não duplicam o efeito. NÃO publica audit_event (operação
 * administrativa de limpeza — alinhado com {@code docs/architecture.md} §4).
 *
 * <p>O token correspondente no Redis já expirou pelo TTL nativo (24h). Este job apenas sincroniza o
 * estado em PG para que o UI veja "EXPIRADO" em vez de "PENDENTE" indefinidamente.
 */
@Component
public class InvitationExpirerJob {

  private static final Logger log = LoggerFactory.getLogger(InvitationExpirerJob.class);

  private final InvitationRepository invitationRepository;

  public InvitationExpirerJob(InvitationRepository invitationRepository) {
    this.invitationRepository = invitationRepository;
  }

  @Scheduled(fixedDelayString = "${app.invitation.expirer-job.fixed-delay-ms:3600000}") // 1h
  @Transactional
  public void expirePending() {
    Instant now = Instant.now();
    int updated = invitationRepository.markExpiredOlderThan(now);
    if (updated > 0) {
      log.info("InvitationExpirerJob marcou {} convites como EXPIRED", updated);
    }
  }
}
