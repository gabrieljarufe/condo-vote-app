package com.condovote.apartment.dto;

import com.condovote.apartment.Apartment;
import java.time.Instant;
import java.util.UUID;

public record ApartmentResponse(
    UUID id,
    UUID condominiumId,
    String unitNumber,
    String block,
    boolean isDelinquent,
    UUID eligibleVoterUserId,
    Instant createdAt) {

  public static ApartmentResponse from(Apartment a) {
    return new ApartmentResponse(
        a.id(),
        a.condominiumId(),
        a.unitNumber(),
        a.block(),
        a.isDelinquent(),
        a.eligibleVoterUserId(),
        a.createdAt());
  }
}
