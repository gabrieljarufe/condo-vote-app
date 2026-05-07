package com.condovote.condominium;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("condominium")
public record Condominium(@Id UUID id, String name, String address, Instant createdAt) {}
