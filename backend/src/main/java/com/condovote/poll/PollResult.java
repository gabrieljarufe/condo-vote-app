package com.condovote.poll;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("poll_result")
public record PollResult(
    @Id UUID pollId,
    UUID condominiumId,
    Integer quorumDenominator,
    Integer totalVotesComputed,
    UUID winningOptionId,
    Boolean quorumReached,
    String
        invalidationReason, // "PRESENCE_QUORUM_NOT_REACHED" | "NO_OPTION_REACHED_THRESHOLD" | null
    String closeTrigger, // "AUTOMATIC_END_TIME" | "AUTOMATIC_ALL_VOTED"
    String votesPerOption, // JSONB armazenado como String JSON cru
    OffsetDateTime computedAt) {}
