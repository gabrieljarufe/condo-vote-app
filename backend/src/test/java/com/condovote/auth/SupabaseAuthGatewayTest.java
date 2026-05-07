package com.condovote.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class SupabaseAuthGatewayTest {

  private final SupabaseAuthGateway gateway = new SupabaseAuthGateway();

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void getCurrentUserId_returnsSubClaimAsUuid() {
    UUID userId = UUID.randomUUID();
    setJwtInContext(userId.toString(), "user@condovote.com");

    assertThat(gateway.getCurrentUserId()).isEqualTo(userId);
  }

  @Test
  void getCurrentUserEmail_returnsEmailClaim() {
    setJwtInContext(UUID.randomUUID().toString(), "user@condovote.com");

    assertThat(gateway.getCurrentUserEmail()).isEqualTo("user@condovote.com");
  }

  private void setJwtInContext(String sub, String email) {
    Jwt jwt =
        Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject(sub)
            .claim("email", email)
            .build();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(new JwtAuthenticationToken(jwt));
    SecurityContextHolder.setContext(context);
  }
}
