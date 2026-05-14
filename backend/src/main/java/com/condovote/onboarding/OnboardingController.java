package com.condovote.onboarding;

import com.condovote.onboarding.dto.CompleteRegistrationRequest;
import com.condovote.onboarding.dto.CompleteRegistrationResponse;
import com.condovote.onboarding.dto.ValidateInvitationResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class OnboardingController {

  private final OnboardingService service;

  public OnboardingController(OnboardingService service) {
    this.service = service;
  }

  @GetMapping("/invitations/validate")
  public ValidateInvitationResponse validate(@RequestParam String token) {
    return service.validate(token);
  }

  @PostMapping("/register/complete")
  @ResponseStatus(HttpStatus.CREATED)
  public CompleteRegistrationResponse complete(
      @Valid @RequestBody CompleteRegistrationRequest req) {
    return service.complete(req);
  }
}
