package com.condovote.shared.tenant;

import com.condovote.auth.AuthGateway;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class TenantInterceptor implements HandlerInterceptor {

  private final AuthGateway authGateway;
  private final TenantMembershipRepository membershipRepository;

  public TenantInterceptor(
      AuthGateway authGateway, TenantMembershipRepository membershipRepository) {
    this.authGateway = authGateway;
    this.membershipRepository = membershipRepository;
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
      throws Exception {
    String tenantHeader = request.getHeader("X-Tenant-Id");
    if (tenantHeader == null || tenantHeader.isBlank()) {
      return true;
    }

    UUID tenantId;
    try {
      tenantId = UUID.fromString(tenantHeader.trim());
    } catch (IllegalArgumentException e) {
      response.sendError(HttpServletResponse.SC_BAD_REQUEST, "X-Tenant-Id inválido");
      return false;
    }

    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null
        || !auth.isAuthenticated()
        || auth.getPrincipal() == null
        || "anonymousUser".equals(auth.getPrincipal())) {
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
      return false;
    }

    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.userBelongsToTenant(userId, tenantId)) {
      response.sendError(HttpServletResponse.SC_FORBIDDEN, "Acesso ao condomínio negado");
      return false;
    }

    TenantContext.set(tenantId);
    return true;
  }

  @Override
  public void afterCompletion(
      HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
    TenantContext.clear();
  }
}
