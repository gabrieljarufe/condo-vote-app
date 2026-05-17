package com.condovote.onboarding.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AcceptAsExistingRequest(
    @NotBlank @Pattern(regexp = "^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$") String cpf,
    @AssertTrue(message = "Confirmação de declaração é obrigatória") boolean acceptanceConfirmed) {}
