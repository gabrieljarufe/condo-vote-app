package com.condovote.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Tag("integration")
@SpringBootTest
@Transactional
class InvitationControllerIT extends AbstractIntegrationTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  // ─── POST /api/condominiums/{id}/invitations ─────────────────────────────

  @Test
  void create_semAutorizacao_retorna401() throws Exception {
    UUID condoId = insertCondo("Condo Inv 401");
    mvc.perform(
            post("/api/condominiums/{id}/invitations", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"apartmentId":"00000000-0000-0000-0000-000000000001",
                     "email":"m@x.com","cpf":"111.444.777-35","role":"OWNER"}
                    """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void create_adminHappyPath_retorna201() throws Exception {
    UUID condoId = insertCondo("Condo Inv Happy");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");

    String body =
        """
        {"apartmentId":"%s","email":"morador@gmail.com","cpf":"111.444.777-35","role":"OWNER"}
        """
            .formatted(aptId);

    mvc.perform(
            post("/api/condominiums/{id}/invitations", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.status").value("PENDING"))
        .andExpect(jsonPath("$.expiresAt").isNotEmpty());

    Long count =
        jdbc.queryForObject(
            "SELECT count(*) FROM email_notification WHERE type='INVITATION' AND status='PENDING'",
            Long.class);
    assertThat(count).isEqualTo(1L);
  }

  @Test
  void create_aptDeOutroCondo_retorna404() throws Exception {
    UUID condoId = insertCondo("Condo Inv A");
    UUID outroCondo = insertCondo("Condo Inv B");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(outroCondo, "202");

    String body =
        """
        {"apartmentId":"%s","email":"m@x.com","cpf":"111.444.777-35","role":"OWNER"}
        """
            .formatted(aptId);

    mvc.perform(
            post("/api/condominiums/{id}/invitations", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isNotFound());
  }

  @Test
  void create_naoAdmin_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo Inv 403");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    UUID aptId = insertApartment(condoId, "100");
    insertAdmin(condoId, adminId);
    insertResident(condoId, aptId, residentId, "OWNER");

    String body =
        """
        {"apartmentId":"%s","email":"m@x.com","cpf":"111.444.777-35","role":"OWNER"}
        """
            .formatted(aptId);

    mvc.perform(
            post("/api/condominiums/{id}/invitations", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isForbidden());
  }

  @Test
  void create_duplicatePending_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Inv Dup");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "303");

    String body =
        """
        {"apartmentId":"%s","email":"dup@x.com","cpf":"111.444.777-35","role":"OWNER"}
        """
            .formatted(aptId);

    // Primeira criação deve passar
    mvc.perform(
            post("/api/condominiums/{id}/invitations", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isCreated());

    // Segunda criação (mesma combinação) deve retornar 409
    mvc.perform(
            post("/api/condominiums/{id}/invitations", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isConflict());
  }

  // ─── POST /api/condominiums/{id}/invitations/bulk ────────────────────────

  @Test
  void createBulk_todasValidas_retorna201() throws Exception {
    UUID condoId = insertCondo("Condo Bulk OK");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    insertApartment(condoId, "101");
    insertApartment(condoId, "102");

    String body =
        """
        {"entries":[
          {"email":"a@x.com","cpf":"111.444.777-35","unitNumber":"101","role":"OWNER"},
          {"email":"b@x.com","cpf":"111.444.777-35","unitNumber":"102","role":"TENANT"}
        ]}
        """;

    mvc.perform(
            post("/api/condominiums/{id}/invitations/bulk", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.created").value(2))
        .andExpect(jsonPath("$.errors").isEmpty());
  }

  @Test
  void createBulk_aptInexistente_retorna422() throws Exception {
    UUID condoId = insertCondo("Condo Bulk Err");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);

    String body =
        """
        {"entries":[
          {"email":"a@x.com","cpf":"111.444.777-35","unitNumber":"999","role":"OWNER"}
        ]}
        """;

    mvc.perform(
            post("/api/condominiums/{id}/invitations/bulk", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.errors[0].field").value("apartment"));

    Long count = jdbc.queryForObject("SELECT count(*) FROM invitation", Long.class);
    assertThat(count).isEqualTo(0L);
  }

  @Test
  void createBulk_acimaDe200_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Bulk Over200");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);

    List<String> entries = new ArrayList<>();
    for (int i = 1; i <= 201; i++) {
      entries.add(
          """
          {"email":"u%d@x.com","cpf":"111.444.777-35","unitNumber":"%d","role":"OWNER"}
          """
              .formatted(i, i));
    }
    String body = "{\"entries\":[" + String.join(",", entries) + "]}";

    mvc.perform(
            post("/api/condominiums/{id}/invitations/bulk", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isBadRequest());
  }

  // ─── GET /api/condominiums/{id}/invitations ───────────────────────────────

  @Test
  void list_admin_retorna200ComConvites() throws Exception {
    UUID condoId = insertCondo("Condo List Inv");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");
    insertInvitationPending(condoId, aptId, "a@x.com", userId);
    insertInvitationPending(condoId, aptId, "b@x.com", userId);

    mvc.perform(
            get("/api/condominiums/{id}/invitations", condoId)
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
  }

  @Test
  void list_filtroStatusPending_retornaApenasPending() throws Exception {
    UUID condoId = insertCondo("Condo List Filter Status");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");
    insertInvitationPending(condoId, aptId, "a@x.com", userId);
    insertInvitationRevoked(condoId, aptId, "b@x.com", userId);

    mvc.perform(
            get("/api/condominiums/{id}/invitations", condoId)
                .param("status", "PENDING")
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].status").value("PENDING"));
  }

  @Test
  void list_filtroAptId_retornaApenasDoApt() throws Exception {
    UUID condoId = insertCondo("Condo List Filter Apt");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID apt1 = insertApartment(condoId, "101");
    UUID apt2 = insertApartment(condoId, "102");
    insertInvitationPending(condoId, apt1, "a@x.com", userId);
    insertInvitationPending(condoId, apt2, "b@x.com", userId);

    mvc.perform(
            get("/api/condominiums/{id}/invitations", condoId)
                .param("apartmentId", apt1.toString())
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].apartmentId").value(apt1.toString()));
  }

  // ─── POST /api/invitations/{id}/resend ───────────────────────────────────

  @Test
  void resend_pending_retorna200ComNovoId() throws Exception {
    UUID condoId = insertCondo("Condo Resend");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");

    // Cria o convite via API para que cpf_encrypted seja válido
    String createBody =
        """
        {"apartmentId":"%s","email":"resend@x.com","cpf":"111.444.777-35","role":"OWNER"}
        """
            .formatted(aptId);
    String createResponse =
        mvc.perform(
                post("/api/condominiums/{id}/invitations", condoId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Tenant-Id", condoId.toString())
                    .content(createBody)
                    .with(jwt().jwt(b -> b.subject(userId.toString()))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    // Extrai o id do JSON de resposta (campo "id")
    String originalId = createResponse.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");

    String responseBody =
        mvc.perform(
                post("/api/invitations/{id}/resend", originalId)
                    .header("X-Tenant-Id", condoId.toString())
                    .with(jwt().jwt(b -> b.subject(userId.toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andReturn()
            .getResponse()
            .getContentAsString();

    // O novo convite deve ter id diferente do original
    assertThat(responseBody).doesNotContain(originalId);

    // O original deve estar REVOKED
    String originalStatus =
        jdbc.queryForObject(
            "SELECT status FROM invitation WHERE id = ?::uuid", String.class, originalId);
    assertThat(originalStatus).isEqualTo("REVOKED");
  }

  // ─── POST /api/invitations/{id}/revoke ───────────────────────────────────

  @Test
  void revoke_pending_retorna204() throws Exception {
    UUID condoId = insertCondo("Condo Revoke");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");
    UUID invId = insertInvitationPending(condoId, aptId, "rev@x.com", userId);

    mvc.perform(
            post("/api/invitations/{id}/revoke", invId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isNoContent());
  }

  @Test
  void revoke_jaRevogado_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Revoke Dup");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");
    UUID invId = insertInvitationRevoked(condoId, aptId, "rev2@x.com", userId);

    mvc.perform(
            post("/api/invitations/{id}/revoke", invId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isConflict());
  }

  // ─── POST /api/invitations/{id}/fix-email ────────────────────────────────

  @Test
  void fixEmail_bounced_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo FixEmail");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");

    // Cria convite via API, depois força status BOUNCED via SQL
    String createBody =
        """
        {"apartmentId":"%s","email":"bounce@x.com","cpf":"111.444.777-35","role":"OWNER"}
        """
            .formatted(aptId);
    String createResponse =
        mvc.perform(
                post("/api/condominiums/{id}/invitations", condoId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Tenant-Id", condoId.toString())
                    .content(createBody)
                    .with(jwt().jwt(b -> b.subject(userId.toString()))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String invId = createResponse.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");

    // Força status para BOUNCED (simula o EmailSenderJob detectando bounce)
    jdbc.update(
        "UPDATE invitation SET status='BOUNCED'::invitation_status WHERE id = ?::uuid", invId);

    mvc.perform(
            post("/api/invitations/{id}/fix-email", invId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content("{\"newEmail\":\"novo@x.com\"}")
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value("novo@x.com"))
        .andExpect(jsonPath("$.status").value("PENDING"));

    // Original deve estar REVOKED
    String originalStatus =
        jdbc.queryForObject(
            "SELECT status FROM invitation WHERE id = ?::uuid", String.class, invId);
    assertThat(originalStatus).isEqualTo("REVOKED");
  }

  @Test
  void fixEmail_pending_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo FixEmail 409");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");
    UUID invId = insertInvitationPending(condoId, aptId, "ok@x.com", userId);

    mvc.perform(
            post("/api/invitations/{id}/fix-email", invId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content("{\"newEmail\":\"outro@x.com\"}")
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isConflict());
  }

  // ─── SQL helpers ─────────────────────────────────────────────────────────

  private UUID insertInvitationPending(UUID condoId, UUID aptId, String email, UUID createdBy) {
    UUID id = UuidV7.generate();
    Timestamp expiresAt = Timestamp.from(Instant.now().plusSeconds(86400));
    jdbc.update(
        """
        INSERT INTO invitation
          (id, condominium_id, apartment_id, email, cpf_encrypted, role, status, expires_at, created_by_user_id, created_at)
        VALUES (?::uuid, ?::uuid, ?::uuid, ?, decode('010203', 'hex'), 'OWNER'::resident_role, 'PENDING'::invitation_status, ?, ?::uuid, now())
        """,
        id.toString(),
        condoId.toString(),
        aptId.toString(),
        email,
        expiresAt,
        createdBy.toString());
    return id;
  }

  private UUID insertInvitationRevoked(UUID condoId, UUID aptId, String email, UUID createdBy) {
    UUID id = UuidV7.generate();
    Timestamp expiresAt = Timestamp.from(Instant.now().plusSeconds(86400));
    jdbc.update(
        """
        INSERT INTO invitation
          (id, condominium_id, apartment_id, email, cpf_encrypted, role, status, expires_at, revoked_at, revoked_by_user_id, created_by_user_id, created_at)
        VALUES (?::uuid, ?::uuid, ?::uuid, ?, decode('010203', 'hex'), 'OWNER'::resident_role, 'REVOKED'::invitation_status, ?, now(), ?::uuid, ?::uuid, now())
        """,
        id.toString(),
        condoId.toString(),
        aptId.toString(),
        email,
        expiresAt,
        createdBy.toString(),
        createdBy.toString());
    return id;
  }

  private UUID insertInvitationBounced(UUID condoId, UUID aptId, String email, UUID createdBy) {
    UUID id = UuidV7.generate();
    Timestamp expiresAt = Timestamp.from(Instant.now().plusSeconds(86400));
    jdbc.update(
        """
        INSERT INTO invitation
          (id, condominium_id, apartment_id, email, cpf_encrypted, role, status, expires_at, created_by_user_id, created_at)
        VALUES (?::uuid, ?::uuid, ?::uuid, ?, decode('010203', 'hex'), 'OWNER'::resident_role, 'BOUNCED'::invitation_status, ?, ?::uuid, now())
        """,
        id.toString(),
        condoId.toString(),
        aptId.toString(),
        email,
        expiresAt,
        createdBy.toString());
    return id;
  }
}
