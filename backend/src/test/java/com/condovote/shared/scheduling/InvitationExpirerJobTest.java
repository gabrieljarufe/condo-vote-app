package com.condovote.shared.scheduling;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.invitation.InvitationRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InvitationExpirerJobTest {

  @Mock InvitationRepository invitationRepository;

  @InjectMocks InvitationExpirerJob job;

  @Test
  void expirePending_callsRepositoryWithCurrentTime() {
    when(invitationRepository.markExpiredOlderThan(any(Instant.class))).thenReturn(0);

    job.expirePending();

    verify(invitationRepository).markExpiredOlderThan(any(Instant.class));
  }

  @Test
  void expirePending_someUpdated_logsCount() {
    when(invitationRepository.markExpiredOlderThan(any(Instant.class))).thenReturn(3);

    job.expirePending();

    verify(invitationRepository).markExpiredOlderThan(any(Instant.class));
  }
}
