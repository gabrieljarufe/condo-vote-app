package com.condovote.apartment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateApartmentRequest(
    @NotBlank @Size(max = 20) String unitNumber, @Size(max = 50) String block) {}
