package com.condovote.shared.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.auth.AuthGateway;
import com.condovote.shared.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class AuditEventPublisherTest {

  @Mock private NamedParameterJdbcTemplate jdbc;
  @Mock private AuthGateway authGateway;

  private AuditEventPublisher publisher;

  @BeforeEach
  void setUp() {
    publisher = new AuditEventPublisher(jdbc, new ObjectMapper(), authGateway);
  }

  @AfterEach
  void clearTenant() {
    TenantContext.clear();
  }

  @Test
  void publish_usesTenantContextAndAuthGateway() {
    UUID tenantId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();
    UUID entityId = UUID.randomUUID();
    TenantContext.set(tenantId);
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    publisher.publish("APARTMENT_CREATED", "apartment", entityId, Map.of("unit", "101"));

    ArgumentCaptor<MapSqlParameterSource> captor =
        ArgumentCaptor.forClass(MapSqlParameterSource.class);
    verify(jdbc).update(anyString(), captor.capture());
    Map<String, Object> values = captor.getValue().getValues();
    assertThat(values).containsEntry("condominiumId", tenantId);
    assertThat(values).containsEntry("actorUserId", userId);
    assertThat(values).containsEntry("eventType", "APARTMENT_CREATED");
    assertThat(values).containsEntry("entityType", "apartment");
    assertThat(values).containsEntry("entityId", entityId);
    assertThat(values.get("payload").toString()).contains("\"unit\":\"101\"");
  }

  @Test
  void publish_throws_whenTenantContextNotSet() {
    assertThatThrownBy(
            () -> publisher.publish("APARTMENT_CREATED", "apartment", UUID.randomUUID(), Map.of()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("TenantContext");
  }

  @Test
  void publish_explicitOverload_usesProvidedTenantAndActor() {
    UUID tenantId = UUID.randomUUID();
    UUID actorId = UUID.randomUUID();
    UUID entityId = UUID.randomUUID();

    publisher.publish(
        "POLL_CLOSED", "poll", entityId, Map.of("reason", "manual"), tenantId, actorId);

    ArgumentCaptor<MapSqlParameterSource> captor =
        ArgumentCaptor.forClass(MapSqlParameterSource.class);
    verify(jdbc).update(anyString(), captor.capture());
    Map<String, Object> values = captor.getValue().getValues();
    assertThat(values).containsEntry("condominiumId", tenantId);
    assertThat(values).containsEntry("actorUserId", actorId);
  }

  @Test
  void publish_explicitOverload_throwsWhenActorNull() {
    assertThatThrownBy(
            () ->
                publisher.publish(
                    "POLL_CLOSED", "poll", UUID.randomUUID(), Map.of(), UUID.randomUUID(), null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("actorUserId");
  }

  @Test
  void publish_acceptsNullPayloadAsEmptyJson() {
    UUID tenantId = UUID.randomUUID();
    TenantContext.set(tenantId);
    when(authGateway.getCurrentUserId()).thenReturn(UUID.randomUUID());

    publisher.publish("APARTMENT_CREATED", "apartment", UUID.randomUUID(), null);

    ArgumentCaptor<MapSqlParameterSource> captor =
        ArgumentCaptor.forClass(MapSqlParameterSource.class);
    verify(jdbc).update(anyString(), captor.capture());
    assertThat(captor.getValue().getValues().get("payload").toString()).isEqualTo("{}");
  }

  @Test
  void publish_explicitOverload_throwsWhenTenantNull() {
    assertThatThrownBy(
            () ->
                publisher.publish(
                    "POLL_CLOSED", "poll", UUID.randomUUID(), Map.of(), null, UUID.randomUUID()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("tenantId");
  }
}
