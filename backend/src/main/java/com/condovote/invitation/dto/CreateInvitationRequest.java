package com.condovote.invitation.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record CreateInvitationRequest(
    @NotNull UUID apartmentId,
    @NotBlank @Email String email,
    @NotBlank
        @Pattern(
            regexp = "[\\d.\\-]{11,14}",
            message = "CPF deve ter 11 dígitos (com ou sem pontuação)")
        String cpf,
    @NotBlank @Pattern(regexp = "OWNER|TENANT", message = "role deve ser OWNER ou TENANT")
        String role) {}
