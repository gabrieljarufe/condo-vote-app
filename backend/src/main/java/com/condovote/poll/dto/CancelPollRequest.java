package com.condovote.poll.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CancelPollRequest(
    @NotBlank @Size(min = 10, max = 500, message = "O motivo deve ter entre 10 e 500 caracteres")
        String reason) {}
