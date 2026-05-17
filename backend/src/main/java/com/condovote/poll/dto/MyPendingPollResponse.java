package com.condovote.poll.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MyPendingPollResponse(
    UUID pollId,
    String title,
    OffsetDateTime scheduledEnd,
    long pendingBallotsCount,
    long totalBallotsCount) {}
