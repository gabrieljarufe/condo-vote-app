package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.exception.UnprocessableEntityException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class PollOpenerTest {

  @Mock PollRepository pollRepository;
  @Mock PollEligibleSnapshotRepository snapshotRepository;
  @Mock AuditEventPublisher auditEventPublisher;
  @Mock NamedParameterJdbcTemplate namedJdbc;

  PollOpener opener;

  UUID pollId = UuidV7.generate();
  UUID condoId = UuidV7.generate();
  UUID actorUserId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    opener = new PollOpener(pollRepository, snapshotRepository, auditEventPublisher, namedJdbc);
  }

  private Poll scheduledPoll() {
    return new Poll(
        pollId,
        condoId,
        "Assembleia",
        null,
        "FIRST",
        "SIMPLE_MAJORITY",
        "SCHEDULED",
        OffsetDateTime.now().minusHours(1),
        OffsetDateTime.now().plusHours(2),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        actorUserId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private Poll openPoll(int eligibleCount) {
    return new Poll(
        pollId,
        condoId,
        "Assembleia",
        null,
        "FIRST",
        "SIMPLE_MAJORITY",
        "OPEN",
        OffsetDateTime.now().minusHours(1),
        OffsetDateTime.now().plusHours(2),
        OffsetDateTime.now(),
        actorUserId,
        eligibleCount,
        null,
        null,
        null,
        null,
        null,
        actorUserId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  @Test
  void open_manualHappyPath_atualizaStatusEPublicaAudit() {
    Poll scheduled = scheduledPoll();
    Poll open = openPoll(5);
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(scheduled))
        .thenReturn(Optional.of(open));
    when(snapshotRepository.insertSnapshotForCondominium(pollId, condoId)).thenReturn(5);
    when(namedJdbc.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

    Poll result = opener.open(pollId, actorUserId, false);

    assertThat(result.status()).isEqualTo("OPEN");
    verify(namedJdbc).update(contains("SET status"), any(MapSqlParameterSource.class));
    verify(auditEventPublisher)
        .publish(
            eq("POLL_OPENED_MANUALLY"),
            eq("poll"),
            eq(pollId),
            any(),
            eq(condoId),
            eq(actorUserId));
  }

  @Test
  void open_automatic_publicaAuditOpenedAuto() {
    Poll scheduled = scheduledPoll();
    Poll open = openPoll(3);
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(scheduled))
        .thenReturn(Optional.of(open));
    when(snapshotRepository.insertSnapshotForCondominium(pollId, condoId)).thenReturn(3);
    when(namedJdbc.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

    opener.open(pollId, actorUserId, true);

    verify(auditEventPublisher)
        .publish(
            eq("POLL_OPENED_AUTO"), eq("poll"), eq(pollId), any(), eq(condoId), eq(actorUserId));
  }

  @Test
  void open_snapshotVazio_lancaUnprocessable() {
    Poll scheduled = scheduledPoll();
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(scheduled));
    when(snapshotRepository.insertSnapshotForCondominium(pollId, condoId)).thenReturn(0);

    assertThatThrownBy(() -> opener.open(pollId, actorUserId, false))
        .isInstanceOf(UnprocessableEntityException.class)
        .hasMessageContaining("elegível");

    verify(namedJdbc, never()).update(anyString(), any(MapSqlParameterSource.class));
  }

  @Test
  void open_pollNaoExiste_lancaNotFound() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> opener.open(pollId, actorUserId, false))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void open_statusNaoScheduled_lancaConflict() {
    Poll draft =
        new Poll(
            pollId,
            condoId,
            "Assembleia",
            null,
            "FIRST",
            "SIMPLE_MAJORITY",
            "DRAFT",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            actorUserId,
            OffsetDateTime.now(),
            OffsetDateTime.now());
    when(pollRepository.findById(pollId)).thenReturn(Optional.of(draft));

    assertThatThrownBy(() -> opener.open(pollId, actorUserId, false))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("DRAFT");
  }
}
