package com.condovote.invitation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BulkCreateInvitationRequest(
    @NotEmpty @Size(max = 200, message = "máximo 200 convites por upload") @Valid
        List<BulkInvitationEntry> entries) {}
