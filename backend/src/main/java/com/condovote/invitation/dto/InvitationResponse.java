package com.condovote.invitation.dto;

import java.time.Instant;
import java.util.UUID;

public record InvitationResponse(
    UUID id,
    UUID apartmentId,
    String email,
    String role,
    String status,
    Instant expiresAt,
    Instant acceptedAt,
    Instant createdAt) {

  public static InvitationResponse from(com.condovote.invitation.Invitation inv) {
    return new InvitationResponse(
        inv.id(),
        inv.apartmentId(),
        inv.email(),
        inv.role(),
        inv.status(),
        inv.expiresAt(),
        inv.acceptedAt(),
        inv.createdAt());
  }
}
