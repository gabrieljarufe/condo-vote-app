package com.condovote.shared.audit;

import com.condovote.auth.AuthGateway;
import com.condovote.shared.UuidV7;
import com.condovote.shared.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Insere linhas em {@code audit_event} dentro da transação corrente. Cada serviço de domínio que
 * altera estado deve chamar este publisher na MESMA @Transactional — assim a rollback atomicamente
 * em caso de falha.
 *
 * <p>Tenant + actor são lidos do {@link TenantContext} para o overload curto. Para chamadas fora de
 * request HTTP (jobs, endpoints públicos) usar o overload com tenant/actor explícitos.
 */
@Component
public class AuditEventPublisher {

  private static final String INSERT_SQL =
      """
            INSERT INTO audit_event
                (id, condominium_id, actor_user_id, event_type, entity_type, entity_id, payload, occurred_at)
            VALUES
                (:id, :condominiumId, :actorUserId, :eventType::audit_event_type, :entityType, :entityId, :payload::jsonb, now())
            """;

  private final NamedParameterJdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final AuthGateway authGateway;

  @Autowired
  public AuditEventPublisher(NamedParameterJdbcTemplate jdbc, AuthGateway authGateway) {
    this(jdbc, new ObjectMapper(), authGateway);
  }

  // visível para testes — permite injetar ObjectMapper customizado
  AuditEventPublisher(
      NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper, AuthGateway authGateway) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.authGateway = authGateway;
  }

  /**
   * Usa tenant do {@link TenantContext} e actor do JWT corrente via {@link AuthGateway}. Apropriado
   * para fluxo HTTP autenticado dentro de @Transactional.
   */
  public void publish(
      String eventType, String entityType, UUID entityId, Map<String, Object> payload) {
    UUID tenantId = TenantContext.get();
    if (tenantId == null) {
      throw new IllegalStateException(
          "AuditEventPublisher.publish requer TenantContext setado; use o overload explícito");
    }
    publish(eventType, entityType, entityId, payload, tenantId, authGateway.getCurrentUserId());
  }

  /**
   * Overload explícito para jobs e endpoints públicos (sem TenantContext). Caller é responsável por
   * fornecer tenant e actor corretos.
   */
  public void publish(
      String eventType,
      String entityType,
      UUID entityId,
      Map<String, Object> payload,
      UUID tenantId,
      UUID actorUserId) {
    if (tenantId == null) {
      throw new IllegalArgumentException("tenantId não pode ser null");
    }
    if (actorUserId == null) {
      throw new IllegalArgumentException(
          "actorUserId não pode ser null (audit_event.actor_user_id NOT NULL)");
    }

    String payloadJson;
    try {
      payloadJson = objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("payload não serializável para JSON", e);
    }

    MapSqlParameterSource params =
        new MapSqlParameterSource()
            .addValue("id", UuidV7.generate())
            .addValue("condominiumId", tenantId)
            .addValue("actorUserId", actorUserId)
            .addValue("eventType", eventType)
            .addValue("entityType", entityType)
            .addValue("entityId", entityId)
            .addValue("payload", payloadJson);

    jdbc.update(INSERT_SQL, params);
  }
}
