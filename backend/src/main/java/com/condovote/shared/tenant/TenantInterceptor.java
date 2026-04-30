package com.condovote.shared.tenant;

import com.condovote.auth.AuthGateway;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;

@Component
public class TenantInterceptor implements HandlerInterceptor {

    private final AuthGateway authGateway;
    private final JdbcTemplate jdbcTemplate;

    public TenantInterceptor(AuthGateway authGateway, JdbcTemplate jdbcTemplate) {
        this.authGateway = authGateway;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
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
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null
                || "anonymousUser".equals(auth.getPrincipal())) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }

        UUID userId = authGateway.getCurrentUserId();
        if (!userBelongsToTenant(userId, tenantId)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Acesso ao condomínio negado");
            return false;
        }

        TenantContext.set(tenantId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TenantContext.clear();
    }

    private boolean userBelongsToTenant(UUID userId, UUID tenantId) {
        Boolean result = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM condominium_admin
                    WHERE user_id = ? AND condominium_id = ? AND revoked_at IS NULL
                ) OR EXISTS (
                    SELECT 1 FROM apartment_resident
                    WHERE user_id = ? AND condominium_id = ? AND ended_at IS NULL
                )
                """,
                Boolean.class,
                userId, tenantId,
                userId, tenantId);
        return Boolean.TRUE.equals(result);
    }
}
