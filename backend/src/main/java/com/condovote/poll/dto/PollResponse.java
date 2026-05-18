package com.condovote.poll.dto;

import com.condovote.poll.Poll;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PollResponse(
    UUID id,
    UUID condominiumId,
    String title,
    String description,
    String convocation,
    String quorumMode,
    String status,
    OffsetDateTime scheduledStart,
    OffsetDateTime scheduledEnd,
    OffsetDateTime openedAt,
    Integer eligibleCount,
    OffsetDateTime closedAt,
    OffsetDateTime cancelledAt,
    String cancellationReason,
    OffsetDateTime createdAt) {

  public static PollResponse from(Poll poll) {
    return new PollResponse(
        poll.id(),
        poll.condominiumId(),
        poll.title(),
        poll.description(),
        poll.convocation(),
        poll.quorumMode(),
        poll.status(),
        poll.scheduledStart(),
        poll.scheduledEnd(),
        poll.openedAt(),
        poll.eligibleCount(),
        poll.closedAt(),
        poll.cancelledAt(),
        poll.cancellationReason(),
        poll.createdAt());
  }
}
