package com.condovote.onboarding.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompleteRegistrationRequest(
    @NotBlank String token,
    @NotBlank String cpf,
    @NotBlank @Size(min = 8, max = 72) String password,
    @NotBlank @Size(max = 255) String fullName,
    @AssertTrue(message = "Confirmação de declaração é obrigatória") boolean acceptanceConfirmed) {}
