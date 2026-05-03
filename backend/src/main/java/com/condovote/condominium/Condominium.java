package com.condovote.condominium;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("condominium")
public record Condominium(
        @Id UUID id,
        String name,
        String address,
        Instant createdAt
) {}
