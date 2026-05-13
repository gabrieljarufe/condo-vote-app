package com.condovote.invitation;

import com.condovote.invitation.dto.BulkCreateInvitationRequest;
import com.condovote.invitation.dto.BulkResultResponse;
import com.condovote.invitation.dto.CreateInvitationRequest;
import com.condovote.invitation.dto.FixEmailRequest;
import com.condovote.invitation.dto.InvitationResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InvitationController {

  private final InvitationService service;

  public InvitationController(InvitationService service) {
    this.service = service;
  }

  @PostMapping("/condominiums/{condominiumId}/invitations")
  @ResponseStatus(HttpStatus.CREATED)
  public InvitationResponse create(
      @PathVariable UUID condominiumId, @Valid @RequestBody CreateInvitationRequest request) {
    return service.create(condominiumId, request);
  }

  @PostMapping("/condominiums/{condominiumId}/invitations/bulk")
  public ResponseEntity<BulkResultResponse> createBulk(
      @PathVariable UUID condominiumId, @Valid @RequestBody BulkCreateInvitationRequest request) {
    BulkResultResponse result = service.createBulk(condominiumId, request);
    HttpStatus status =
        result.errors().isEmpty() ? HttpStatus.CREATED : HttpStatus.UNPROCESSABLE_ENTITY;
    return ResponseEntity.status(status).body(result);
  }

  @GetMapping("/condominiums/{condominiumId}/invitations")
  public List<InvitationResponse> list(
      @PathVariable UUID condominiumId,
      @RequestParam(required = false) UUID apartmentId,
      @RequestParam(required = false) String status) {
    return service.listByCondominium(condominiumId, apartmentId, status);
  }

  @PostMapping("/invitations/{id}/resend")
  public InvitationResponse resend(@PathVariable UUID id) {
    return service.resend(id);
  }

  @PostMapping("/invitations/{id}/revoke")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void revoke(@PathVariable UUID id) {
    service.revoke(id);
  }

  @PostMapping("/invitations/{id}/fix-email")
  public InvitationResponse fixEmail(
      @PathVariable UUID id, @Valid @RequestBody FixEmailRequest request) {
    return service.fixEmail(id, request);
  }
}
