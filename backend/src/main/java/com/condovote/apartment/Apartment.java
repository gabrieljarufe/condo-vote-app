package com.condovote.apartment;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("apartment")
public record Apartment(
    @Id UUID id,
    UUID condominiumId,
    String block,
    String unitNumber,
    UUID eligibleVoterUserId,
    boolean isDelinquent,
    Instant createdAt) {}
