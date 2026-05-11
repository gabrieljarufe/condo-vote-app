package com.condovote;

import com.condovote.shared.UuidV7;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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

  @Autowired protected JdbcTemplate jdbc;

  static final PostgreSQLContainer<?> postgres;

  static {
    postgres = new PostgreSQLContainer<>("postgres:16");
    postgres.start();
  }

  /**
   * Mocks dos beans Redis — evitam conexão TCP real ao Redis durante testes de integração.
   *
   * <p>RedisConfig usa @ConditionalOnMissingBean, então estes mocks substituem todos os três beans
   * sem que o Lettuce tente estabelecer conexão TCP.
   */
  @MockitoBean RedisClient redisClient;

  @MockitoBean
  @SuppressWarnings("rawtypes")
  StatefulRedisConnection redisConnection;

  @MockitoBean
  @SuppressWarnings("rawtypes")
  RedisCommands redisCommands;

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
    // Valores dummy para testes — variáveis obrigatórias em prod, mas sem efeito real em testes.
    registry.add("app.actuator.username", () -> "test-actuator");
    registry.add("app.actuator.password", () -> "test-password");
    // URL Redis dummy — beans Redis são mockados via @MockitoBean acima.
    registry.add("app.redis.url", () -> "redis://localhost:6379");
    // Chave de 64 bytes para AES-256-SIV — dummy seguro para testes (não usada em prod).
    registry.add(
        "app.cpf.encryption-key",
        () ->
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
                + "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40");
  }

  // --- fixtures compartilhadas ---

  protected UUID insertCondo(String name) {
    UUID id = UuidV7.generate();
    jdbc.update(
        "INSERT INTO condominium (id, name, address, created_at) VALUES (?, ?, 'Rua Test, 1', now())",
        id,
        name);
    return id;
  }

  protected UUID insertApartment(UUID condoId, String unit) {
    UUID id = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at) VALUES (?, ?, ?, false, now())",
        id,
        condoId,
        unit);
    return id;
  }

  protected void insertAdmin(UUID condoId, UUID userId) {
    jdbc.update(
        "INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (?, ?, ?, now())",
        UuidV7.generate(),
        condoId,
        userId);
  }

  protected void insertRevokedAdmin(UUID condoId, UUID userId) {
    jdbc.update(
        "INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at, revoked_at, revoked_by_user_id) VALUES (?, ?, ?, now(), now(), ?)",
        UuidV7.generate(),
        condoId,
        userId,
        UuidV7.generate());
  }

  protected void insertResident(UUID condoId, UUID aptId, UUID userId, String role) {
    jdbc.update(
        "INSERT INTO apartment_resident (id, condominium_id, apartment_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?::resident_role, now())",
        UuidV7.generate(),
        condoId,
        aptId,
        userId,
        role);
  }

  protected void insertEndedResident(UUID condoId, UUID aptId, UUID userId, String role) {
    jdbc.update(
        "INSERT INTO apartment_resident (id, condominium_id, apartment_id, user_id, role, joined_at, ended_at, ended_by_user_id, end_reason) VALUES (?, ?, ?, ?, ?::resident_role, now(), now(), ?, 'REMOVED_BY_ADMIN'::resident_end_reason)",
        UuidV7.generate(),
        condoId,
        aptId,
        userId,
        role,
        UuidV7.generate());
  }
}
