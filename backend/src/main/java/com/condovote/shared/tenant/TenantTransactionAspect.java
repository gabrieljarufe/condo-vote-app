package com.condovote.shared.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Aplica SET LOCAL app.current_tenant na transação corrente quando TenantContext está populado.
 *
 * Deve ter order > 0 para rodar DENTRO do @Transactional proxy (que usa order = 0 via
 * WebMvcConfig). SET LOCAL no PostgreSQL é transaction-scoped — exige TX ativa.
 */
@Aspect
@Component
@Order(10)
public class TenantTransactionAspect {

    @PersistenceContext
    private EntityManager entityManager;

    @Around("@annotation(org.springframework.transaction.annotation.Transactional) || @within(org.springframework.transaction.annotation.Transactional)")
    public Object applyTenant(ProceedingJoinPoint pjp) throws Throwable {
        UUID tenantId = TenantContext.get();
        if (tenantId != null) {
            entityManager.createNativeQuery(
                    "SELECT set_config('app.current_tenant', :tenant, true)")
                    .setParameter("tenant", tenantId.toString())
                    .getSingleResult();
        }
        return pjp.proceed();
    }
}
