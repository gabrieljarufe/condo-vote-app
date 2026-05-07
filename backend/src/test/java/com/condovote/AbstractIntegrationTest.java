package com.condovote;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base para todos os testes que precisam do contexto Spring completo + banco real.
 *
 * <p>Usa o padrão Singleton do Testcontainers: um único container Postgres é iniciado via bloco
 * estático e compartilhado por todas as subclasses durante a mesma JVM. Isso evita um spin-up por
 * classe de teste — o overhead é ~2s no total, não por suite.
 *
 * <p>O profile ativo é o default (application.yaml), sem seed de dev. Flyway aplica apenas
 * classpath:db/migration — banco limpo, só schema.
 *
 * <p>Subclasses declaram @SpringBootTest e seus próprios @Test. Para isolamento entre testes,
 * use @Transactional (Spring faz rollback automático).
 */
public abstract class AbstractIntegrationTest {

  static final PostgreSQLContainer<?> postgres;

  static {
    postgres = new PostgreSQLContainer<>("postgres:16");
    postgres.start();
  }

  @DynamicPropertySource
  static void overrideProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    // URI fictício: satisfaz o auto-configure do OAuth2 Resource Server na inicialização.
    // As chaves públicas só são buscadas na primeira requisição autenticada real —
    // nunca durante contextLoads ou testes com JWT mockado.
    registry.add(
        "spring.security.oauth2.resourceserver.jwt.jwk-set-uri",
        () -> "http://localhost:9999/auth/v1/.well-known/jwks.json");
  }
}
