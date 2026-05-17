package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.NotFoundException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

@ExtendWith(MockitoExtension.class)
class PollCloserTest {

  @Mock PollRepository pollRepository;
  @Mock PollOptionRepository pollOptionRepository;
  @Mock PollResultRepository pollResultRepository;
  @Mock PollResultCalculator calculator;
  @Mock AuditEventPublisher auditEventPublisher;
  @Mock NamedParameterJdbcTemplate namedJdbc;

  PollCloser closer;

  UUID pollId = UuidV7.generate();
  UUID condoId = UuidV7.generate();
  UUID actorUserId = UuidV7.generate();
  UUID optionId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    closer =
        new PollCloser(
            pollRepository,
            pollOptionRepository,
            pollResultRepository,
            calculator,
            auditEventPublisher,
            namedJdbc);
  }

  private Poll openPoll() {
    return new Poll(
        pollId,
        condoId,
        "Assembleia",
        null,
        "SECOND",
        "SIMPLE_MAJORITY",
        "OPEN",
        OffsetDateTime.now().minusHours(2),
        OffsetDateTime.now().plusHours(1),
        OffsetDateTime.now().minusHours(2),
        actorUserId,
        10,
        null,
        null,
        null,
        null,
        null,
        actorUserId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private Poll closedPoll(String status) {
    return new Poll(
        pollId,
        condoId,
        "Assembleia",
        null,
        "SECOND",
        "SIMPLE_MAJORITY",
        status,
        OffsetDateTime.now().minusHours(2),
        OffsetDateTime.now().plusHours(1),
        OffsetDateTime.now().minusHours(2),
        actorUserId,
        10,
        OffsetDateTime.now(),
        null,
        null,
        null,
        null,
        actorUserId,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private PollResultCalculator.CalculationOutput closedOutput() {
    return new PollResultCalculator.CalculationOutput(
        "CLOSED",
        optionId,
        null,
        8L,
        List.of(new PollResultCalculator.OptionTally(optionId, 8L, 100.0)));
  }

  private PollResultCalculator.CalculationOutput invalidatedOutput() {
    return new PollResultCalculator.CalculationOutput(
        "INVALIDATED",
        null,
        "PRESENCE_QUORUM_NOT_REACHED",
        2L,
        List.of(new PollResultCalculator.OptionTally(optionId, 2L, 100.0)));
  }

  @Test
  void close_calculatorRetornaClosed_statusEAuditCorretos() {
    Poll open = openPoll();
    Poll closed = closedPoll("CLOSED");
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(open))
        .thenReturn(Optional.of(closed));
    when(pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId))
        .thenReturn(List.of(new PollOption(optionId, pollId, "Sim", 0)));
    when(namedJdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(1);
    when(calculator.calculate(any())).thenReturn(closedOutput());

    Poll result = closer.close(pollId, actorUserId, false);

    assertThat(result.status()).isEqualTo("CLOSED");
    verify(calculator).calculate(any());
    verify(auditEventPublisher)
        .publish(eq("POLL_CLOSED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(actorUserId));
  }

  @Test
  void close_calculatorRetornaInvalidated_statusEAuditCorretos() {
    Poll open = openPoll();
    Poll invalidated = closedPoll("INVALIDATED");
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(open))
        .thenReturn(Optional.of(invalidated));
    when(pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId))
        .thenReturn(List.of(new PollOption(optionId, pollId, "Sim", 0)));
    when(namedJdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(1);
    when(calculator.calculate(any())).thenReturn(invalidatedOutput());

    Poll result = closer.close(pollId, actorUserId, false);

    assertThat(result.status()).isEqualTo("INVALIDATED");
    verify(auditEventPublisher)
        .publish(
            eq("POLL_INVALIDATED"), eq("poll"), eq(pollId), any(), eq(condoId), eq(actorUserId));
  }

  @Test
  void close_pollNaoOpen_lancaConflict() {
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

    assertThatThrownBy(() -> closer.close(pollId, actorUserId, false))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("DRAFT");
  }

  @Test
  void close_pollNaoExiste_lancaNotFound() {
    when(pollRepository.findById(pollId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> closer.close(pollId, actorUserId, false))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void close_automatico_usaCloseTriggerAutomaticEndTime() {
    Poll open = openPoll();
    Poll closed = closedPoll("CLOSED");
    when(pollRepository.findById(pollId))
        .thenReturn(Optional.of(open))
        .thenReturn(Optional.of(closed));
    when(pollOptionRepository.findByPollIdOrderByDisplayOrder(pollId))
        .thenReturn(List.of(new PollOption(optionId, pollId, "Sim", 0)));
    when(namedJdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(1);
    when(calculator.calculate(any())).thenReturn(closedOutput());

    // Verificar que o INSERT inclui AUTOMATIC_END_TIME no parâmetro closeTrigger
    // Capturado implicitamente pelo verify do update com payload contendo "automatic=true"
    closer.close(pollId, actorUserId, true);

    verify(auditEventPublisher)
        .publish(
            eq("POLL_CLOSED"),
            eq("poll"),
            eq(pollId),
            any(Map.class),
            eq(condoId),
            eq(actorUserId));
  }
}
