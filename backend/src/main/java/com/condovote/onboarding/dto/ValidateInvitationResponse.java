package com.condovote.onboarding.dto;

import java.time.Instant;

/**
 * Sempre 200 OK. O campo {@code state} comunica a situação ao frontend, evitando que ele precise
 * interpretar status HTTP diferentes para cada caso de erro de convite.
 */
public record ValidateInvitationResponse(
    State state,
    String email,
    String apartmentLabel,
    String condominiumName,
    String role,
    Instant expiresAt) {

  public enum State {
    VALID,
    NOT_FOUND,
    EXPIRED,
    REVOKED,
    ALREADY_ACCEPTED
  }

  public static ValidateInvitationResponse of(State state) {
    return new ValidateInvitationResponse(state, null, null, null, null, null);
  }
}
