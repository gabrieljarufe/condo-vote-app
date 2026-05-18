package com.condovote.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.condovote.AbstractIntegrationTest;
import com.condovote.auth.SupabaseAdminGateway;
import com.condovote.shared.UuidV7;
import com.condovote.shared.crypto.CpfEncryptor;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Tag("integration")
@SpringBootTest
@Transactional
class OnboardingControllerIT extends AbstractIntegrationTest {

  @Autowired WebApplicationContext context;
  @Autowired CpfEncryptor cpfEncryptor;

  @MockitoBean SupabaseAdminGateway supabaseAdminGateway;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void validate_tokenInexistente_retornaNOT_FOUND() throws Exception {
    when(redisCommands.get(anyString())).thenReturn(null);
    mvc.perform(get("/api/public/invitations/validate").param("token", "abc"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("NOT_FOUND"));
  }

  @Test
  void validate_pendingComEmailJaExistente_retornaEmailHasAccountTrue() throws Exception {
    UUID condoId = insertCondo("Onboarding LinkExisting");
    UUID aptId = insertApartment(condoId, "501");
    UUID adminId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    String email = "ja-tem-conta@example.com";
    byte[] cpfBytes = cpfEncryptor.encryptToBytes("111.444.777-35");
    Instant expiresAt = Instant.now().plusSeconds(3600);

    // Cria invitation PENDING
    jdbc.update(
        """
            INSERT INTO invitation
                (id, condominium_id, apartment_id, email, cpf_encrypted, role,
                 status, expires_at, created_by_user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'OWNER'::resident_role, 'PENDING'::invitation_status,
                    ?, ?, now())
            """,
        invitationId,
        condoId,
        aptId,
        email,
        cpfBytes,
        java.sql.Timestamp.from(expiresAt),
        adminId);

    // Cria app_user com o mesmo e-mail (CPF diferente, irrelevante para validate)
    UUID existingUserId = UuidV7.generate();
    byte[] otherCpfBytes = cpfEncryptor.encryptToBytes("529.982.247-25");
    jdbc.update(
        """
            INSERT INTO app_user
                (id, name, email, cpf_encrypted, is_active, consent_accepted_at,
                 consent_policy_version, created_at)
            VALUES (?, 'Existing User', ?, ?, true, now(), 'v1', now())
            """,
        existingUserId,
        email,
        otherCpfBytes);

    String token = UUID.randomUUID().toString();
    String redisPayload =
        "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}";
    when(redisCommands.get("invitation:token:" + token)).thenReturn(redisPayload);

    mvc.perform(get("/api/public/invitations/validate").param("token", token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("VALID"))
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.emailHasAccount").value(true));
  }

  @Test
  void completeRegistration_happyPath_retorna201ECriaResidente() throws Exception {
    UUID condoId = insertCondo("Onboarding Happy");
    UUID aptId = insertApartment(condoId, "401");
    UUID adminId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    String cpf = "111.444.777-35";
    byte[] cpfBytes = cpfEncryptor.encryptToBytes(cpf);
    String email = "morador-h4@example.com";
    Instant expiresAt = Instant.now().plusSeconds(3600);

    jdbc.update(
        """
            INSERT INTO invitation
                (id, condominium_id, apartment_id, email, cpf_encrypted, role,
                 status, expires_at, created_by_user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'OWNER'::resident_role, 'PENDING'::invitation_status,
                    ?, ?, now())
            """,
        invitationId,
        condoId,
        aptId,
        email,
        cpfBytes,
        java.sql.Timestamp.from(expiresAt),
        adminId);

    String token = UUID.randomUUID().toString();
    String redisPayload =
        "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}";
    when(redisCommands.get("invitation:token:" + token)).thenReturn(redisPayload);

    UUID newUserId = UuidV7.generate();
    when(supabaseAdminGateway.createUser(email, "senha-forte-1!")).thenReturn(newUserId);

    String body =
        """
        {"token":"%s","cpf":"%s","password":"senha-forte-1!","fullName":"Maria Test","acceptanceConfirmed":true}
        """
            .formatted(token, cpf);

    mvc.perform(
            post("/api/public/register/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.userId").value(newUserId.toString()));

    // app_user criado
    Long appUserCount =
        jdbc.queryForObject("SELECT count(*) FROM app_user WHERE id = ?", Long.class, newUserId);
    assertThat(appUserCount).isEqualTo(1L);

    // apartment_resident criado vinculando user → apt
    Long residentCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM apartment_resident WHERE user_id = ? AND apartment_id = ?",
            Long.class,
            newUserId,
            aptId);
    assertThat(residentCount).isEqualTo(1L);

    // invitation marcado ACCEPTED
    String status =
        jdbc.queryForObject(
            "SELECT status::text FROM invitation WHERE id = ?", String.class, invitationId);
    assertThat(status).isEqualTo("ACCEPTED");

    // audit_event publicado: INVITATION_ACCEPTED com flow=CREATE_NEW_USER
    Long invAcceptedCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event WHERE event_type = 'INVITATION_ACCEPTED'::audit_event_type "
                + "AND entity_id = ? AND payload->>'flow' = 'CREATE_NEW_USER'",
            Long.class,
            invitationId);
    assertThat(invAcceptedCount).isEqualTo(1L);

    // audit_event publicado: RESIDENT_JOINED para o app_user recém-criado
    Long residentJoinedCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event WHERE event_type = 'RESIDENT_JOINED'::audit_event_type "
                + "AND payload->>'invitationId' = ? AND payload->>'userId' = ?",
            Long.class,
            invitationId.toString(),
            newUserId.toString());
    assertThat(residentJoinedCount).isEqualTo(1L);
  }

  @Test
  void completeRegistration_semAcceptanceConfirmed_retorna400() throws Exception {
    UUID condoId = insertCondo("Onboarding Acceptance");
    UUID aptId = insertApartment(condoId, "403");
    UUID adminId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    String cpf = "111.444.777-35";
    byte[] cpfBytes = cpfEncryptor.encryptToBytes(cpf);
    String email = "morador-no-accept@example.com";
    Instant expiresAt = Instant.now().plusSeconds(3600);

    jdbc.update(
        """
            INSERT INTO invitation
                (id, condominium_id, apartment_id, email, cpf_encrypted, role,
                 status, expires_at, created_by_user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'OWNER'::resident_role, 'PENDING'::invitation_status,
                    ?, ?, now())
            """,
        invitationId,
        condoId,
        aptId,
        email,
        cpfBytes,
        java.sql.Timestamp.from(expiresAt),
        adminId);

    String token = UUID.randomUUID().toString();
    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");

    // Body sem acceptanceConfirmed=true → @AssertTrue deve rejeitar com 400.
    String body =
        """
        {"token":"%s","cpf":"%s","password":"senha-forte-1!","fullName":"Maria","acceptanceConfirmed":false}
        """
            .formatted(token, cpf);

    mvc.perform(
            post("/api/public/register/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void completeRegistration_ownerAceita_setaEligibleVoterUserIdNoApartamento() throws Exception {
    UUID condoId = insertCondo("Onboarding EligibleVoter OWNER");
    UUID aptId = insertApartment(condoId, "501");
    UUID adminId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    String cpf = "111.444.777-35";
    byte[] cpfBytes = cpfEncryptor.encryptToBytes(cpf);
    String email = "owner-501@example.com";
    Instant expiresAt = Instant.now().plusSeconds(3600);

    jdbc.update(
        """
            INSERT INTO invitation
                (id, condominium_id, apartment_id, email, cpf_encrypted, role,
                 status, expires_at, created_by_user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'OWNER'::resident_role, 'PENDING'::invitation_status,
                    ?, ?, now())
            """,
        invitationId,
        condoId,
        aptId,
        email,
        cpfBytes,
        java.sql.Timestamp.from(expiresAt),
        adminId);

    String token = UUID.randomUUID().toString();
    String redisPayload =
        "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}";
    when(redisCommands.get("invitation:token:" + token)).thenReturn(redisPayload);

    UUID newUserId = UuidV7.generate();
    when(supabaseAdminGateway.createUser(email, "senha-forte-1!")).thenReturn(newUserId);

    String body =
        """
        {"token":"%s","cpf":"%s","password":"senha-forte-1!","fullName":"Owner Test"}
        """
            .formatted(token, cpf);

    mvc.perform(
            post("/api/public/register/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());

    // eligible_voter_user_id deve ter sido setado para o novo userId (OWNER)
    UUID eligibleVoterUserId =
        jdbc.queryForObject(
            "SELECT eligible_voter_user_id FROM apartment WHERE id = ?", UUID.class, aptId);
    assertThat(eligibleVoterUserId).isEqualTo(newUserId);

    // audit APARTMENT_ELIGIBLE_VOTER_SET deve ter sido publicado
    Long auditCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event WHERE event_type = 'APARTMENT_ELIGIBLE_VOTER_SET'::audit_event_type AND entity_id = ?",
            Long.class,
            aptId);
    assertThat(auditCount).isEqualTo(1L);
  }

  @Test
  void completeRegistration_tenantAceita_naoAlteraEligibleVoterUserId() throws Exception {
    UUID condoId = insertCondo("Onboarding EligibleVoter TENANT");
    UUID aptId = insertApartment(condoId, "502");
    UUID adminId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    String cpf = "111.444.777-35";
    byte[] cpfBytes = cpfEncryptor.encryptToBytes(cpf);
    String email = "tenant-502@example.com";
    Instant expiresAt = Instant.now().plusSeconds(3600);

    jdbc.update(
        """
            INSERT INTO invitation
                (id, condominium_id, apartment_id, email, cpf_encrypted, role,
                 status, expires_at, created_by_user_id, created_at)
            VALUES (?, ?, ?, ?, ?, 'TENANT'::resident_role, 'PENDING'::invitation_status,
                    ?, ?, now())
            """,
        invitationId,
        condoId,
        aptId,
        email,
        cpfBytes,
        java.sql.Timestamp.from(expiresAt),
        adminId);

    String token = UUID.randomUUID().toString();
    String redisPayload =
        "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}";
    when(redisCommands.get("invitation:token:" + token)).thenReturn(redisPayload);

    UUID newUserId = UuidV7.generate();
    when(supabaseAdminGateway.createUser(email, "senha-forte-1!")).thenReturn(newUserId);

    String body =
        """
        {"token":"%s","cpf":"%s","password":"senha-forte-1!","fullName":"Tenant Test"}
        """
            .formatted(token, cpf);

    mvc.perform(
            post("/api/public/register/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());

    // eligible_voter_user_id deve permanecer NULL para TENANT (sem delegação — H6)
    UUID eligibleVoterUserId =
        jdbc.queryForObject(
            "SELECT eligible_voter_user_id FROM apartment WHERE id = ?", UUID.class, aptId);
    assertThat(eligibleVoterUserId).isNull();

    // nenhum audit APARTMENT_ELIGIBLE_VOTER_SET deve ter sido publicado
    Long auditCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event WHERE event_type = 'APARTMENT_ELIGIBLE_VOTER_SET'::audit_event_type AND entity_id = ?",
            Long.class,
            aptId);
    assertThat(auditCount).isEqualTo(0L);
  }

  @Test
  void completeRegistration_cpfNaoBate_retorna400() throws Exception {
    UUID condoId = insertCondo("Onboarding CPF");
    UUID aptId = insertApartment(condoId, "402");
    UUID adminId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    byte[] cpfBytes = cpfEncryptor.encryptToBytes("111.444.777-35");
    Instant expiresAt = Instant.now().plusSeconds(3600);

    jdbc.update(
        """
            INSERT INTO invitation
                (id, condominium_id, apartment_id, email, cpf_encrypted, role,
                 status, expires_at, created_by_user_id, created_at)
            VALUES (?, ?, ?, 'a@x.com', ?, 'OWNER'::resident_role, 'PENDING'::invitation_status,
                    ?, ?, now())
            """,
        invitationId,
        condoId,
        aptId,
        cpfBytes,
        java.sql.Timestamp.from(expiresAt),
        adminId);

    String token = UUID.randomUUID().toString();
    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");

    String body =
        """
        {"token":"%s","cpf":"12345678901","password":"senha-forte-1!","fullName":"X","acceptanceConfirmed":true}
        """
            .formatted(token);

    mvc.perform(
            post("/api/public/register/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }
}
