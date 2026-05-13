package com.condovote.invitation.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record BulkInvitationEntry(
    @NotBlank @Email String email,
    @NotBlank @Pattern(regexp = "[\\d.\\-]{11,14}") String cpf,
    String block, // pode ser null/blank se condo não tem blocos
    @NotBlank String unitNumber,
    @NotBlank @Pattern(regexp = "OWNER|TENANT") String role) {}
