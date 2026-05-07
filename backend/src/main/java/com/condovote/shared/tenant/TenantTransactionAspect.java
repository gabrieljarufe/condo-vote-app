package com.condovote.shared.tenant;

import java.util.UUID;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Aplica SET LOCAL app.current_tenant na transação corrente quando TenantContext está populado.
 *
 * <p>Deve ter order > 0 para rodar DENTRO do @Transactional proxy (que usa order = 0 via
 * WebMvcConfig). SET LOCAL no PostgreSQL é transaction-scoped — exige TX ativa.
 */
@Aspect
@Component
@Order(10)
public class TenantTransactionAspect {

  private final JdbcTemplate jdbcTemplate;

  public TenantTransactionAspect(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Around(
      "@annotation(org.springframework.transaction.annotation.Transactional) || @within(org.springframework.transaction.annotation.Transactional)")
  public Object applyTenant(ProceedingJoinPoint pjp) throws Throwable {
    UUID tenantId = TenantContext.get();
    if (tenantId != null) {
      jdbcTemplate.queryForObject(
          "SELECT set_config('app.current_tenant', ?, true)", String.class, tenantId.toString());
    }
    return pjp.proceed();
  }
}
