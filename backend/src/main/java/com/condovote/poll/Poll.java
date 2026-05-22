package com.condovote.poll;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("poll")
public record Poll(
    @Id UUID id,
    UUID condominiumId,
    String title,
    String description,
    String convocation, // "FIRST" | "SECOND"
    String
        quorumMode, // "SIMPLE_MAJORITY" | "ABSOLUTE_MAJORITY" | "QUALIFIED_2_3" | "QUALIFIED_3_4"
    String status, // "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED" | "INVALIDATED"
    OffsetDateTime scheduledStart,
    OffsetDateTime scheduledEnd,
    OffsetDateTime openedAt,
    UUID openedByUserId,
    Integer eligibleCount,
    OffsetDateTime closedAt,
    OffsetDateTime cancelledAt,
    String cancellationReason,
    UUID cancelledByUserId,
    UUID previousPollId,
    UUID createdByUserId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
