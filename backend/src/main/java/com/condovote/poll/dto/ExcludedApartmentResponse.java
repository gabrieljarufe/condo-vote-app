package com.condovote.poll.dto;

import java.util.UUID;

public record ExcludedApartmentResponse(UUID apartmentId, String apartmentLabel, String reason) {}
