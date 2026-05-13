package com.condovote.shared.scheduling;

import com.condovote.invitation.InvitationRepository;
import com.condovote.shared.email.EmailDeliveryException;
import com.condovote.shared.email.EmailGateway;
import com.condovote.shared.email.EmailMessage;
import com.condovote.shared.email.EmailTemplateRenderer;
import com.condovote.shared.notification.EmailNotification;
import com.condovote.shared.notification.EmailNotificationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Processa transactional outbox de e-mails. Lê {@code email_notification} com status PENDING e
 * scheduled_for <= now(), renderiza template Thymeleaf e envia via {@link EmailGateway} (resolvido
 * por profile: SMTP em dev/test, Resend em prod). Em falha, aplica backoff exponencial; em bounce
 * hard, marca BOUNCED tanto na notificação quanto no Invitation correspondente.
 *
 * <p>Lock distribuído NÃO é necessário em v1 — backend Coolify é single-replica. Documentar como
 * nota para H10.
 */
@Component
public class EmailSenderJob {

  private static final Logger log = LoggerFactory.getLogger(EmailSenderJob.class);
  private static final int BATCH_SIZE = 50;
  private static final int MAX_ATTEMPTS = 3;
  private static final Duration RETRY_1 = Duration.ofMinutes(1);
  private static final Duration RETRY_2 = Duration.ofMinutes(5);
  private static final Duration RETRY_3 = Duration.ofMinutes(30);

  private final EmailNotificationRepository notificationRepository;
  private final InvitationRepository invitationRepository;
  private final EmailGateway emailGateway;
  private final EmailTemplateRenderer renderer;
  private final ObjectMapper objectMapper;

  public EmailSenderJob(
      EmailNotificationRepository notificationRepository,
      InvitationRepository invitationRepository,
      EmailGateway emailGateway,
      EmailTemplateRenderer renderer) {
    this.notificationRepository = notificationRepository;
    this.invitationRepository = invitationRepository;
    this.emailGateway = emailGateway;
    this.renderer = renderer;
    this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
  }

  @Scheduled(fixedDelayString = "${app.email.sender-job.fixed-delay-ms:30000}")
  public void processPending() {
    Instant now = Instant.now();
    List<EmailNotification> batch =
        notificationRepository.findPendingDueForSending(now, BATCH_SIZE);
    if (batch.isEmpty()) return;
    log.debug("EmailSenderJob processando {} notificações", batch.size());
    for (EmailNotification notif : batch) {
      processOne(notif);
    }
  }

  private void processOne(EmailNotification notif) {
    try {
      EmailMessage message = renderForType(notif);
      emailGateway.send(message);
      notificationRepository.markSent(notif.id(), Instant.now());
    } catch (EmailDeliveryException e) {
      int newAttempts = notif.attempts() + 1;
      if (e.isHardBounce()) {
        notificationRepository.markBounced(notif.id(), newAttempts, e.getMessage());
        propagateHardBounceToInvitation(notif);
        log.warn("E-mail rebotou (hard bounce) — notif={}, error={}", notif.id(), e.getMessage());
      } else if (newAttempts >= MAX_ATTEMPTS) {
        notificationRepository.markFailedFinal(notif.id(), newAttempts, e.getMessage());
        log.error("E-mail falhou após {} tentativas — notif={}", newAttempts, notif.id());
      } else {
        Instant nextRetryAt = Instant.now().plus(backoffFor(newAttempts));
        notificationRepository.markFailed(notif.id(), newAttempts, e.getMessage(), nextRetryAt);
        log.warn(
            "E-mail falhou (tentativa {}/{}) — notif={}, próximo retry={}",
            newAttempts,
            MAX_ATTEMPTS,
            notif.id(),
            nextRetryAt);
      }
    } catch (Exception e) {
      // erro inesperado (template render, JSON parse) — trata como soft failure
      int newAttempts = notif.attempts() + 1;
      String errMsg = e.getClass().getSimpleName() + ": " + e.getMessage();
      if (newAttempts >= MAX_ATTEMPTS) {
        notificationRepository.markFailedFinal(notif.id(), newAttempts, errMsg);
      } else {
        Instant nextRetryAt = Instant.now().plus(backoffFor(newAttempts));
        notificationRepository.markFailed(notif.id(), newAttempts, errMsg, nextRetryAt);
      }
      log.error("Erro inesperado processando notif={}", notif.id(), e);
    }
  }

  private EmailMessage renderForType(EmailNotification notif) throws Exception {
    if (!"INVITATION".equals(notif.type())) {
      throw new IllegalStateException("Tipo de e-mail não suportado em v1: " + notif.type());
    }
    Map<String, Object> payload = objectMapper.readValue(notif.payload(), new TypeReference<>() {});
    String to = (String) payload.get("email");
    String role = (String) payload.get("role");
    String roleLabel = "OWNER".equals(role) ? "Proprietário" : "Inquilino";
    EmailTemplateRenderer.InvitationEmailVars vars =
        new EmailTemplateRenderer.InvitationEmailVars(
            (String) payload.getOrDefault("condoName", "Seu condomínio"),
            (String) payload.getOrDefault("aptLabel", payload.get("apartmentId").toString()),
            roleLabel,
            (String) payload.get("acceptUrl"));
    return renderer.renderInvitation(to, vars);
  }

  private void propagateHardBounceToInvitation(EmailNotification notif) {
    try {
      Map<String, Object> payload =
          objectMapper.readValue(notif.payload(), new TypeReference<>() {});
      String invId = (String) payload.get("invitationId");
      if (invId != null) {
        invitationRepository.markBouncedIfPending(UUID.fromString(invId));
      }
    } catch (Exception ex) {
      log.warn("Falha ao propagar bounce para invitation a partir de notif={}", notif.id(), ex);
    }
  }

  private Duration backoffFor(int attempts) {
    return switch (attempts) {
      case 1 -> RETRY_1;
      case 2 -> RETRY_2;
      default -> RETRY_3;
    };
  }
}
