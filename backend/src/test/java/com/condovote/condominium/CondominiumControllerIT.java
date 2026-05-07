package com.condovote.condominium;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/**
 * Testa a pilha HTTP completa: Security → TenantInterceptor → Controller → Service → Repository.
 *
 * <p>Usa MockMvc com contexto Spring real (não standalone) para garantir que interceptors, filtros
 * de segurança e exception handlers participam do ciclo de vida da requisição. @Transactional faz
 * rollback automático dos fixtures de banco após cada teste.
 */
@Tag("integration")
@SpringBootTest
@Transactional
class CondominiumControllerIT extends AbstractIntegrationTest {

  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void semAutorizacaoRetorna401() throws Exception {
    mvc.perform(get("/api/me/condominiums").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void tenantIdComFormatoInvalidoRetorna400() throws Exception {
    mvc.perform(
            get("/api/me/condominiums")
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", "nao-e-um-uuid")
                .with(jwt().jwt(b -> b.subject(UuidV7.generate().toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void semTenantRetorna200ListaVazia() throws Exception {
    UUID userId = UuidV7.generate();

    mvc.perform(
            get("/api/me/condominiums")
                .accept(MediaType.APPLICATION_JSON)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(content().json("[]"));
  }

  @Test
  void usuarioNaoMembroRetorna403() throws Exception {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Alheio");

    mvc.perform(
            get("/api/me/condominiums")
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isForbidden());
  }

  @Test
  void membroAdminComTenantRetorna200() throws Exception {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Visível");
    insertAdmin(condoId, userId);

    mvc.perform(
            get("/api/me/condominiums")
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(condoId.toString()))
        .andExpect(jsonPath("$[0].name").value("Condo Visível"))
        .andExpect(jsonPath("$[0].role").value("ADMIN"));
  }

  @Test
  void membroResidenteComTenantRetorna200() throws Exception {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Residente");
    UUID aptId = insertApartment(condoId, "101");
    insertResident(condoId, aptId, userId, "OWNER");

    mvc.perform(
            get("/api/me/condominiums")
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].role").value("OWNER"));
  }

  // --- fixtures ---

  private UUID insertCondo(String name) {
    UUID id = UuidV7.generate();
    jdbc.update(
        "INSERT INTO condominium (id, name, address, created_at) VALUES (?, ?, 'Rua Test, 1', now())",
        id,
        name);
    return id;
  }

  private UUID insertApartment(UUID condoId, String unit) {
    UUID id = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at) VALUES (?, ?, ?, false, now())",
        id,
        condoId,
        unit);
    return id;
  }

  private void insertAdmin(UUID condoId, UUID userId) {
    jdbc.update(
        "INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (?, ?, ?, now())",
        UuidV7.generate(),
        condoId,
        userId);
  }

  private void insertResident(UUID condoId, UUID aptId, UUID userId, String role) {
    jdbc.update(
        "INSERT INTO apartment_resident (id, condominium_id, apartment_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?::resident_role, now())",
        UuidV7.generate(),
        condoId,
        aptId,
        userId,
        role);
  }
}
