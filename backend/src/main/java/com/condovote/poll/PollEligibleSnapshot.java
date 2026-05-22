package com.condovote.poll;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("poll_eligible_snapshot")
public record PollEligibleSnapshot(
    @Id UUID id,
    UUID pollId,
    UUID condominiumId,
    UUID apartmentId,
    UUID eligibleVoterUserId,
    OffsetDateTime snapshottedAt) {}
