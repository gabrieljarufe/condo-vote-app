package com.condovote.shared.scheduling;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.condovote.invitation.InvitationRepository;
import com.condovote.shared.email.EmailDeliveryException;
import com.condovote.shared.email.EmailGateway;
import com.condovote.shared.email.EmailMessage;
import com.condovote.shared.email.EmailTemplateRenderer;
import com.condovote.shared.notification.EmailNotification;
import com.condovote.shared.notification.EmailNotificationRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmailSenderJobTest {

  @Mock EmailNotificationRepository notificationRepository;
  @Mock InvitationRepository invitationRepository;
  @Mock EmailGateway emailGateway;
  @Mock EmailTemplateRenderer renderer;

  EmailSenderJob job;

  UUID notifId = UUID.randomUUID();
  UUID userId = UUID.randomUUID();
  UUID invId = UUID.randomUUID();
  UUID aptId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    job = new EmailSenderJob(notificationRepository, invitationRepository, emailGateway, renderer);
  }

  private String validPayload() {
    return """
        {"invitationId":"%s","email":"a@b.com","role":"OWNER","apartmentId":"%s",
         "expiresAt":"2026-05-13T14:00:00Z","acceptUrl":"http://x/y","condoName":"Condo X","aptLabel":"A 101"}
        """
        .formatted(invId, aptId);
  }

  private EmailNotification buildNotif(int attempts, String type, String payload) {
    return new EmailNotification(
        notifId,
        userId,
        type,
        payload,
        "PENDING",
        attempts,
        null,
        Instant.now(),
        null,
        Instant.now());
  }

  @Test
  void processPending_emptyBatch_doesNothing() {
    when(notificationRepository.findPendingDueForSending(any(), eq(50))).thenReturn(List.of());

    job.processPending();

    verifyNoInteractions(emailGateway);
    verifyNoInteractions(renderer);
    verifyNoInteractions(invitationRepository);
  }

  @Test
  void processPending_validInvitation_callsGatewayAndMarksSent() throws Exception {
    EmailNotification notif = buildNotif(0, "INVITATION", validPayload());
    when(notificationRepository.findPendingDueForSending(any(), eq(50))).thenReturn(List.of(notif));

    EmailMessage fakeMsg = new EmailMessage("a@b.com", "Convite", "<p>html</p>", "text");
    when(renderer.renderInvitation(eq("a@b.com"), any())).thenReturn(fakeMsg);

    job.processPending();

    verify(emailGateway).send(fakeMsg);
    verify(notificationRepository).markSent(eq(notifId), any(Instant.class));
    verify(notificationRepository, never()).markFailed(any(), anyInt(), any(), any());
    verify(notificationRepository, never()).markBounced(any(), anyInt(), any());
    verify(notificationRepository, never()).markFailedFinal(any(), anyInt(), any());
  }

  @Test
  void processPending_gatewayThrowsHardBounce_marksBouncedAndPropagatesInvitation()
      throws Exception {
    EmailNotification notif = buildNotif(0, "INVITATION", validPayload());
    when(notificationRepository.findPendingDueForSending(any(), eq(50))).thenReturn(List.of(notif));

    EmailMessage fakeMsg = new EmailMessage("a@b.com", "Convite", "<p>html</p>", "text");
    when(renderer.renderInvitation(any(), any())).thenReturn(fakeMsg);
    doThrow(new EmailDeliveryException("550 address rejected", true))
        .when(emailGateway)
        .send(any());

    job.processPending();

    verify(notificationRepository).markBounced(eq(notifId), eq(1), any());
    verify(invitationRepository).markBouncedIfPending(invId);
    verify(notificationRepository, never()).markSent(any(), any());
    verify(notificationRepository, never()).markFailed(any(), anyInt(), any(), any());
    verify(notificationRepository, never()).markFailedFinal(any(), anyInt(), any());
  }

  @Test
  void processPending_gatewayThrowsSoftFirstAttempt_marksFailedWithRetry() throws Exception {
    EmailNotification notif = buildNotif(0, "INVITATION", validPayload());
    when(notificationRepository.findPendingDueForSending(any(), eq(50))).thenReturn(List.of(notif));

    EmailMessage fakeMsg = new EmailMessage("a@b.com", "Convite", "<p>html</p>", "text");
    when(renderer.renderInvitation(any(), any())).thenReturn(fakeMsg);
    doThrow(new EmailDeliveryException("timeout", false)).when(emailGateway).send(any());

    Instant before = Instant.now();
    job.processPending();
    Instant after = Instant.now();

    ArgumentCaptor<Instant> nextRetryCaptor = ArgumentCaptor.forClass(Instant.class);
    verify(notificationRepository).markFailed(eq(notifId), eq(1), any(), nextRetryCaptor.capture());

    Instant nextRetry = nextRetryCaptor.getValue();
    // nextRetry deve ser ~1min adiante (RETRY_1)
    assert nextRetry.isAfter(before.plusSeconds(50)) : "nextRetry deve ser após before+50s";
    assert nextRetry.isBefore(after.plusSeconds(70)) : "nextRetry deve ser antes de after+70s";

    verify(notificationRepository, never()).markSent(any(), any());
    verify(notificationRepository, never()).markBounced(any(), anyInt(), any());
    verify(notificationRepository, never()).markFailedFinal(any(), anyInt(), any());
  }

  @Test
  void processPending_gatewayThrowsSoftThirdAttempt_marksFailedFinal() throws Exception {
    // attempts=2 significa que a próxima será a 3ª (>= MAX_ATTEMPTS)
    EmailNotification notif = buildNotif(2, "INVITATION", validPayload());
    when(notificationRepository.findPendingDueForSending(any(), eq(50))).thenReturn(List.of(notif));

    EmailMessage fakeMsg = new EmailMessage("a@b.com", "Convite", "<p>html</p>", "text");
    when(renderer.renderInvitation(any(), any())).thenReturn(fakeMsg);
    doThrow(new EmailDeliveryException("timeout again", false)).when(emailGateway).send(any());

    job.processPending();

    verify(notificationRepository).markFailedFinal(eq(notifId), eq(3), any());
    verify(notificationRepository, never()).markSent(any(), any());
    verify(notificationRepository, never()).markBounced(any(), anyInt(), any());
    verify(notificationRepository, never()).markFailed(any(), anyInt(), any(), any());
  }

  @Test
  void processPending_unsupportedType_marksFailedFinalEventually() {
    // type "POLL_SCHEDULED" não suportado em v1 → cai no catch Exception genérico
    EmailNotification notif = buildNotif(2, "POLL_SCHEDULED", "{}");
    when(notificationRepository.findPendingDueForSending(any(), eq(50))).thenReturn(List.of(notif));

    job.processPending();

    // attempts=2 → newAttempts=3 >= MAX_ATTEMPTS → markFailedFinal
    verify(notificationRepository).markFailedFinal(eq(notifId), eq(3), any());
    verify(notificationRepository, never()).markSent(any(), any());
    verify(notificationRepository, never()).markBounced(any(), anyInt(), any());
    verify(notificationRepository, never()).markFailed(any(), anyInt(), any(), any());
    verifyNoInteractions(emailGateway);
    verifyNoInteractions(invitationRepository);
  }
}
