package com.condovote.apartment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BatchCreateApartmentRequest(
    @NotNull @Size(min = 1, max = 500) @Valid List<CreateApartmentRequest> items) {}
