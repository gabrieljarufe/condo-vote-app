package com.condovote.poll;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("vote")
public record Vote(
    @Id UUID id,
    UUID condominiumId,
    UUID pollId,
    UUID pollOptionId,
    UUID apartmentId,
    UUID voterUserId,
    OffsetDateTime votedAt) {}
