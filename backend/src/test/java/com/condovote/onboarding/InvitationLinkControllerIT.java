package com.condovote.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.condovote.AbstractIntegrationTest;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Tag("integration")
@SpringBootTest
@Transactional
class InvitationLinkControllerIT extends AbstractIntegrationTest {

  @Autowired WebApplicationContext context;
  @Autowired CpfEncryptor cpfEncryptor;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  private record Fixture(
      UUID condoId,
      UUID aptId,
      UUID invitationId,
      UUID userId,
      String email,
      String token,
      String cpfRaw) {}

  /**
   * Cria: condo, apto, app_user (com CPF criptografado), invitation PENDING para esse e-mail e
   * stuba o token no Redis. Retorna o conjunto de IDs para usar nas asserts.
   */
  private Fixture seed(String emailSuffix, String unit, String cpfRaw) {
    UUID condoId = insertCondo("Link Existing " + emailSuffix);
    UUID aptId = insertApartment(condoId, unit);
    UUID userId = UuidV7.generate();
    UUID invitationId = UuidV7.generate();
    String email = emailSuffix + "@example.com";
    byte[] cpfBytes = cpfEncryptor.encryptToBytes(cpfRaw);

    jdbc.update(
        """
            INSERT INTO app_user
                (id, name, email, cpf_encrypted, is_active, consent_accepted_at,
                 consent_policy_version, created_at)
            VALUES (?, 'Existing User', ?, ?, true, now(), 'v1', now())
            """,
        userId,
        email,
        cpfBytes);

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
        UuidV7.generate());

    String token = UUID.randomUUID().toString();
    String redisPayload =
        "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}";
    when(redisCommands.get("invitation:token:" + token)).thenReturn(redisPayload);

    return new Fixture(condoId, aptId, invitationId, userId, email, token, cpfRaw);
  }

  @Test
  void semJwt_retorna401() throws Exception {
    String body =
        """
        {"acceptanceConfirmed":true}
        """;
    mvc.perform(
            post("/api/invitations/{token}/accept-as-existing", "qualquer")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void happyPath_retorna204CriaResidenteEMarcaAccepted() throws Exception {
    Fixture fx = seed("ok", "601", "111.444.777-35");

    String body =
        """
        {"acceptanceConfirmed":true}
        """;

    mvc.perform(
            post("/api/invitations/{token}/accept-as-existing", fx.token())
                .with(jwt().jwt(b -> b.subject(fx.userId().toString()).claim("email", fx.email())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNoContent());

    Long residentCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM apartment_resident WHERE user_id = ? AND apartment_id = ?",
            Long.class,
            fx.userId(),
            fx.aptId());
    assertThat(residentCount).isEqualTo(1L);

    String invStatus =
        jdbc.queryForObject(
            "SELECT status::text FROM invitation WHERE id = ?", String.class, fx.invitationId());
    assertThat(invStatus).isEqualTo("ACCEPTED");

    Long invAccepted =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event "
                + "WHERE event_type = 'INVITATION_ACCEPTED'::audit_event_type AND entity_id = ?",
            Long.class,
            fx.invitationId());
    assertThat(invAccepted).isEqualTo(1L);

    Long residentJoined =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event "
                + "WHERE event_type = 'RESIDENT_JOINED'::audit_event_type "
                + "AND condominium_id = ? AND actor_user_id = ?",
            Long.class,
            fx.condoId(),
            fx.userId());
    assertThat(residentJoined).isEqualTo(1L);

    // OWNER aceitando convite deve virar eligible_voter do apartamento — sem isso, o snapshot
    // de elegibilidade (PollEligibleSnapshotRepository) exclui o apto e o morador não vota.
    UUID eligibleVoter =
        jdbc.queryForObject(
            "SELECT eligible_voter_user_id FROM apartment WHERE id = ?", UUID.class, fx.aptId());
    assertThat(eligibleVoter).isEqualTo(fx.userId());

    Long eligibleVoterSetAudit =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event "
                + "WHERE event_type = 'APARTMENT_ELIGIBLE_VOTER_SET'::audit_event_type "
                + "AND entity_id = ?",
            Long.class,
            fx.aptId());
    assertThat(eligibleVoterSetAudit).isEqualTo(1L);
  }

  @Test
  void ownerJaTinhaEligibleVoter_naoSobrescreveENaoEmiteAudit() throws Exception {
    Fixture fx = seed("preexist", "605", "111.444.777-35");

    // Pré-popula eligible_voter_user_id com outro UUID (simula OWNER anterior).
    UUID outroOwner = UuidV7.generate();
    jdbc.update(
        "INSERT INTO app_user (id, name, email, cpf_encrypted, is_active, consent_accepted_at,"
            + " consent_policy_version, created_at) VALUES (?, 'Outro', 'outro-pre@example.com',"
            + " ?, true, now(), 'v1', now())",
        outroOwner,
        cpfEncryptor.encryptToBytes("529.982.247-25"));
    jdbc.update(
        "UPDATE apartment SET eligible_voter_user_id = ? WHERE id = ?", outroOwner, fx.aptId());

    String body = "{\"acceptanceConfirmed\":true}";

    mvc.perform(
            post("/api/invitations/{token}/accept-as-existing", fx.token())
                .with(jwt().jwt(b -> b.subject(fx.userId().toString()).claim("email", fx.email())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNoContent());

    // Guard IS NULL preserva o valor pré-existente — não sobrescreve.
    UUID eligibleVoterApos =
        jdbc.queryForObject(
            "SELECT eligible_voter_user_id FROM apartment WHERE id = ?", UUID.class, fx.aptId());
    assertThat(eligibleVoterApos).isEqualTo(outroOwner);

    // Nenhum audit APARTMENT_ELIGIBLE_VOTER_SET emitido (rowsUpdated == 0).
    Long auditCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event "
                + "WHERE event_type = 'APARTMENT_ELIGIBLE_VOTER_SET'::audit_event_type "
                + "AND entity_id = ?",
            Long.class,
            fx.aptId());
    assertThat(auditCount).isEqualTo(0L);
  }

  @Test
  void emailJwtDiferenteDoConvite_retorna403() throws Exception {
    Fixture fx = seed("xemail", "602", "111.444.777-35");

    String body =
        """
        {"acceptanceConfirmed":true}
        """;

    mvc.perform(
            post("/api/invitations/{token}/accept-as-existing", fx.token())
                .with(
                    jwt()
                        .jwt(
                            b ->
                                b.subject(fx.userId().toString())
                                    .claim("email", "outro@example.com")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isForbidden());
  }

  @Test
  void acceptanceConfirmedFalse_retorna400() throws Exception {
    Fixture fx = seed("noconfirm", "603", "111.444.777-35");

    String body = "{\"acceptanceConfirmed\":false}";

    mvc.perform(
            post("/api/invitations/{token}/accept-as-existing", fx.token())
                .with(jwt().jwt(b -> b.subject(fx.userId().toString()).claim("email", fx.email())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  /**
   * Stress test de idempotência: simula caso onde a residência ativa já existia (insert manual) e o
   * token ainda está válido + invitation ainda PENDING. Resultado esperado: 204, sem segundo
   * apartment_resident, evento INVITATION_ACCEPTED com flow=LINK_EXISTING_USER_IDEMPOTENT, sem
   * evento RESIDENT_JOINED.
   */
  @Test
  void idempotencia_residenciaJaExiste_naoCriaSegundaENaoEmiteResidentJoined() throws Exception {
    Fixture fx = seed("idemp", "604", "111.444.777-35");

    // Pré-insere residência ativa (simula vínculo prévio).
    UUID preExistingResidentId = UuidV7.generate();
    jdbc.update(
        """
            INSERT INTO apartment_resident
                (id, condominium_id, apartment_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?, 'OWNER'::resident_role, now())
            """,
        preExistingResidentId,
        fx.condoId(),
        fx.aptId(),
        fx.userId());

    String body = "{\"acceptanceConfirmed\":true}";

    mvc.perform(
            post("/api/invitations/{token}/accept-as-existing", fx.token())
                .with(jwt().jwt(b -> b.subject(fx.userId().toString()).claim("email", fx.email())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNoContent());

    Long residentCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM apartment_resident WHERE user_id = ? AND apartment_id = ?",
            Long.class,
            fx.userId(),
            fx.aptId());
    assertThat(residentCount).isEqualTo(1L);

    Long residentJoined =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event "
                + "WHERE event_type = 'RESIDENT_JOINED'::audit_event_type "
                + "AND condominium_id = ? AND actor_user_id = ?",
            Long.class,
            fx.condoId(),
            fx.userId());
    assertThat(residentJoined).isEqualTo(0L);

    Long invAcceptedIdempotent =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_event "
                + "WHERE event_type = 'INVITATION_ACCEPTED'::audit_event_type "
                + "AND entity_id = ? "
                + "AND payload->>'flow' = 'LINK_EXISTING_USER_IDEMPOTENT'",
            Long.class,
            fx.invitationId());
    assertThat(invAcceptedIdempotent).isEqualTo(1L);
  }
}
