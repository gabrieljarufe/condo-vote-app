package com.condovote.shared.tenant;

import com.condovote.auth.AuthGateway;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantInterceptorTest {

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
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void semHeaderPassaCross_tenant() throws Exception {
        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isTrue();
        assertThat(TenantContext.get()).isNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void headerInvalidoRetorna400() throws Exception {
        request.addHeader("X-Tenant-Id", "nao-e-uuid");

        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_BAD_REQUEST);
        assertThat(TenantContext.get()).isNull();
    }

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        request.addHeader("X-Tenant-Id", tenantId.toString());
        SecurityContextHolder.clearContext();

        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Test
    void usuarioNaoPertenceAoTenantRetorna403() throws Exception {
        request.addHeader("X-Tenant-Id", tenantId.toString());
        setupJwtAuth();
        when(authGateway.getCurrentUserId()).thenReturn(userId);
        when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(false);

        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
        assertThat(TenantContext.get()).isNull();
    }

    @Test
    void usuarioAdminPertenceAoTenantSetaContexto() throws Exception {
        request.addHeader("X-Tenant-Id", tenantId.toString());
        setupJwtAuth();
        when(authGateway.getCurrentUserId()).thenReturn(userId);
        when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);

        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isTrue();
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(TenantContext.get()).isEqualTo(tenantId);
    }

    @Test
    void afterCompletionLimpaTenantContext() throws Exception {
        TenantContext.set(tenantId);

        interceptor.afterCompletion(request, response, null, null);

        assertThat(TenantContext.get()).isNull();
    }

    @Test
    void afterCompletionSemContextoPreviewmenteSetadoNaoLancaExcecao() {
        // afterCompletion não é chamado quando preHandle retorna false.
        // Se por qualquer motivo for chamado sem TenantContext, não deve lançar exceção.
        assertThat(TenantContext.get()).isNull();

        interceptor.afterCompletion(request, response, null, null);

        assertThat(TenantContext.get()).isNull();
    }

    @Test
    void headerComApenasEspacosTratadoComoCrossTenant() throws Exception {
        request.addHeader("X-Tenant-Id", "   ");

        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isTrue();
        assertThat(TenantContext.get()).isNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void headerComEspacosNasBordasAceitaUuidValido() throws Exception {
        request.addHeader("X-Tenant-Id", "  " + tenantId + "  ");
        setupJwtAuth();
        when(authGateway.getCurrentUserId()).thenReturn(userId);
        when(membershipRepository.userBelongsToTenant(userId, tenantId)).thenReturn(true);

        boolean result = interceptor.preHandle(request, response, null);

        assertThat(result).isTrue();
        assertThat(TenantContext.get()).isEqualTo(tenantId);
    }

    @Test
    void threadLocalIsolaTenantsDeDiferentesThreads() throws Exception {
        UUID tenantDaThread2 = UUID.randomUUID();
        CountDownLatch thread2Setou = new CountDownLatch(1);
        CountDownLatch thread1Leu = new CountDownLatch(1);
        AtomicReference<UUID> tenantVistoPelaThread2 = new AtomicReference<>();

        TenantContext.set(tenantId);

        Thread thread2 = new Thread(() -> {
            TenantContext.set(tenantDaThread2);
            thread2Setou.countDown();
            try { thread1Leu.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            tenantVistoPelaThread2.set(TenantContext.get());
            TenantContext.clear();
        });
        thread2.start();

        thread2Setou.await();
        UUID tenantVistoPelaThread1 = TenantContext.get();
        thread1Leu.countDown();
        thread2.join();

        assertThat(tenantVistoPelaThread1).isEqualTo(tenantId);
        assertThat(tenantVistoPelaThread2.get()).isEqualTo(tenantDaThread2);
    }

    private void setupJwtAuth() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(userId.toString())
                .claim("email", "test@test.com")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        var auth = new JwtAuthenticationToken(jwt, java.util.List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
