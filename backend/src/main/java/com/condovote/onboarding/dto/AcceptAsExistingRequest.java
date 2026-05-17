package com.condovote.onboarding.dto;

import jakarta.validation.constraints.AssertTrue;

public record AcceptAsExistingRequest(
    @AssertTrue(message = "Confirmação de declaração é obrigatória") boolean acceptanceConfirmed) {}
