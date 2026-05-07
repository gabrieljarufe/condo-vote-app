package com.condovote.shared.config;

import com.condovote.shared.tenant.TenantInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * @EnableTransactionManagement(order = 0): @Transactional proxy vira o wrapper mais externo.
 * TenantTransactionAspect (@Order(10)) roda DENTRO da transação já aberta, garantindo que SET LOCAL
 * seja transaction-scoped e não vaze entre requisições no pool de conexões.
 */
@Configuration
@EnableTransactionManagement(order = 0)
public class WebMvcConfig implements WebMvcConfigurer {

  private final TenantInterceptor tenantInterceptor;

  public WebMvcConfig(TenantInterceptor tenantInterceptor) {
    this.tenantInterceptor = tenantInterceptor;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(tenantInterceptor);
  }
}
