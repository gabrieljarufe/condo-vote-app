package com.condovote.invitation.dto;

import java.util.List;

public record BulkResultResponse(
    int created, List<InvitationResponse> invitations, List<BulkRowError> errors) {

  public record BulkRowError(int rowIndex, String field, String message) {}
}
