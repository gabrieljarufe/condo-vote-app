package com.condovote.shared.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.condovote.auth.AuthGateway;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

@ExtendWith(MockitoExtension.class)
class TenantInterceptorMdcTest {

  @Mock AuthGateway authGateway;
  @Mock TenantMembershipRepository membershipRepository;

  TenantInterceptor interceptor;
  MockHttpServletRequest request;
  MockHttpServletResponse response;

  UUID userId = UUID.randomUUID();
  UUID tenantId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    interceptor = new TenantInterceptor(authGateway, membershipRepository);
    request = new MockHttpServletRequest();
    response = new MockHttpServletResponse();
    MDC.clear();
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
    SecurityContextHolder.clearContext();
    MDC.clear();
  }

  @Test
  void preHandleComXRequestIdSetaMdcRequestId() throws Exception {
    request.addHeader("X-Tenant-Id", tenantId.toString());
    request.addHeader("X-Request-Id", "req-123");
    setupJwtAuth();
    when(authGateway.getCurrentUserId()).thenReturn(userId);
    when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);

    interceptor.preHandle(request, response, null);

    assertThat(MDC.get("request_id")).isEqualTo("req-123");
    assertThat(response.getHeader("X-Request-Id")).isEqualTo("req-123");
  }

  @Test
  void preHandleSemHeaderGeraUuidNoMdc() throws Exception {
    request.addHeader("X-Tenant-Id", tenantId.toString());
    setupJwtAuth();
    when(authGateway.getCurrentUserId()).thenReturn(userId);
    when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);

    interceptor.preHandle(request, response, null);

    String requestId = MDC.get("request_id");
    assertThat(requestId).isNotNull();
    // Validate it's a valid UUID
    assertThat(UUID.fromString(requestId)).isNotNull();
  }

  @Test
  void preHandleComCfRayUsaCfRay() throws Exception {
    request.addHeader("X-Tenant-Id", tenantId.toString());
    request.addHeader("cf-ray", "ABC123XYZ");
    setupJwtAuth();
    when(authGateway.getCurrentUserId()).thenReturn(userId);
    when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);

    interceptor.preHandle(request, response, null);

    assertThat(MDC.get("request_id")).isEqualTo("ABC123XYZ");
  }

  @Test
  void afterCompletionLimpaMdc() throws Exception {
    request.addHeader("X-Tenant-Id", tenantId.toString());
    setupJwtAuth();
    when(authGateway.getCurrentUserId()).thenReturn(userId);
    when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);
    interceptor.preHandle(request, response, null);

    interceptor.afterCompletion(request, response, null, null);

    Map<String, String> mdcMap = MDC.getCopyOfContextMap();
    assertThat(mdcMap == null || mdcMap.isEmpty()).isTrue();
  }

  @Test
  void exceptionNoHandlerNaoVazaMdc() throws Exception {
    request.addHeader("X-Tenant-Id", tenantId.toString());
    setupJwtAuth();
    when(authGateway.getCurrentUserId()).thenReturn(userId);
    when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);
    interceptor.preHandle(request, response, null);

    // Simula exception no handler — afterCompletion ainda é chamado
    interceptor.afterCompletion(request, response, null, new RuntimeException("handler error"));

    Map<String, String> mdcMap = MDC.getCopyOfContextMap();
    assertThat(mdcMap == null || mdcMap.isEmpty()).isTrue();
  }

  private void setupJwtAuth() {
    Jwt jwt =
        Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject(userId.toString())
            .claim("email", "test@test.com")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    var auth = new JwtAuthenticationToken(jwt, List.of());
    SecurityContextHolder.getContext().setAuthentication(auth);
  }
}
