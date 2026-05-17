package com.condovote.onboarding;

import com.condovote.onboarding.dto.AcceptAsExistingRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint autenticado para vincular um convite a uma conta existente. Ao contrário do {@link
 * OnboardingController} que vive em {@code /api/public} e usa o token Redis como credencial, este
 * controller exige JWT — o usuário já está logado e está apenas associando o apartamento à conta.
 */
@RestController
@RequestMapping("/api/invitations")
public class InvitationLinkController {

  private final OnboardingService service;

  public InvitationLinkController(OnboardingService service) {
    this.service = service;
  }

  @PostMapping("/{token}/accept-as-existing")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void acceptAsExisting(
      @PathVariable String token,
      @Valid @RequestBody AcceptAsExistingRequest req,
      @AuthenticationPrincipal Jwt jwt) {
    service.acceptAsExistingUser(
        token, jwt.getClaimAsString("email"), UUID.fromString(jwt.getSubject()));
  }
}
