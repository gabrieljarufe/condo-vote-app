package com.condovote.invitation;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("invitation")
public record Invitation(
    @Id UUID id,
    UUID condominiumId,
    UUID apartmentId,
    String email,
    byte[] cpfEncrypted, // BYTEA — usa CpfEncryptor.encryptToBytes
    String role, // "OWNER" | "TENANT"
    String status, // "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" | "BOUNCED"
    Instant expiresAt,
    Instant acceptedAt,
    Instant revokedAt,
    UUID revokedByUserId,
    UUID createdByUserId,
    Instant createdAt) {}
