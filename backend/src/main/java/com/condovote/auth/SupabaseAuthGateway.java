package com.condovote.auth;

import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class SupabaseAuthGateway implements AuthGateway {

  @Override
  public UUID getCurrentUserId() {
    return UUID.fromString(jwt().getSubject());
  }

  @Override
  public String getCurrentUserEmail() {
    return jwt().getClaimAsString("email");
  }

  private Jwt jwt() {
    return (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
  }
}
