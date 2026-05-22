package com.condovote.poll;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Tag("integration")
@SpringBootTest
@Transactional
class VoteControllerIT extends AbstractIntegrationTest {

  @Autowired WebApplicationContext context;

  private final ObjectMapper objectMapper = new ObjectMapper();

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  // --- utilitários de data ---

  private String futureDate(int plusHours) {
    return OffsetDateTime.now(ZoneOffset.UTC)
        .plusHours(plusHours)
        .truncatedTo(ChronoUnit.SECONDS)
        .toString();
  }

  // --- utilitários de fixture de poll ---

  /** Cria condomínio + admin + DRAFT poll via HTTP e retorna o id do poll como string. */
  private String criarDraftPoll(UUID condoId, UUID adminId) throws Exception {
    String body =
        """
        {
          "title": "Votação Teste",
          "description": "Descrição",
          "convocation": "FIRST",
          "quorumMode": "SIMPLE_MAJORITY",
          "scheduledStart": "%s",
          "scheduledEnd": "%s",
          "options": ["Sim", "Não"]
        }
        """
            .formatted(futureDate(1), futureDate(2));

    MvcResult result =
        mvc.perform(
                post("/api/condominiums/{condoId}/polls", condoId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Tenant-Id", condoId.toString())
                    .content(body)
                    .with(jwt().jwt(b -> b.subject(adminId.toString()))))
            .andExpect(status().isCreated())
            .andReturn();

    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
  }

  /** Publica poll DRAFT → SCHEDULED via HTTP. */
  private void publicarPoll(String pollId, UUID condoId, UUID adminId) throws Exception {
    mvc.perform(
            post("/api/polls/{id}/publish", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());
  }

  /** Abre um poll SCHEDULED via HTTP. */
  private void abrirPoll(String pollId, UUID condoId, UUID adminId) throws Exception {
    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());
  }

  /**
   * Insere apartamento elegível com eligible_voter_user_id definido (entra no snapshot). Também
   * insere o usuário como apartment_resident (OWNER) para que o TenantInterceptor o aceite.
   */
  private UUID insertApartmentEligivel(UUID condoId, String unit, UUID voterUserId) {
    UUID aptId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent,"
            + " eligible_voter_user_id, created_at) VALUES (?, ?, ?, false, ?, now())",
        aptId,
        condoId,
        unit,
        voterUserId);
    // Registra como morador para passar no TenantInterceptor.userBelongsToTenant
    insertResident(condoId, aptId, voterUserId, "OWNER");
    return aptId;
  }

  /**
   * Insere apartamento inadimplente (não entra no snapshot). Também insere o usuário como resident
   * para que o TenantInterceptor o aceite (o bloqueio ocorre no snapshot, não no interceptor).
   */
  private UUID insertApartmentInadimplente(UUID condoId, String unit, UUID voterUserId) {
    UUID aptId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent,"
            + " eligible_voter_user_id, created_at) VALUES (?, ?, ?, true, ?, now())",
        aptId,
        condoId,
        unit,
        voterUserId);
    // Registra como morador para passar no TenantInterceptor
    insertResident(condoId, aptId, voterUserId, "OWNER");
    return aptId;
  }

  /** Obtém o id da primeira opção de um poll. */
  private UUID getFirstOptionId(String pollId) {
    return jdbc.queryForObject(
        "SELECT id FROM poll_option WHERE poll_id = ?::uuid ORDER BY display_order LIMIT 1",
        UUID.class,
        pollId);
  }

  /** Vota em uma poll aberta. */
  private MvcResult votar(
      String pollId, UUID condoId, UUID voterUserId, UUID apartmentId, UUID optionId)
      throws Exception {
    String body =
        """
        {"apartmentId": "%s", "optionId": "%s"}
        """
            .formatted(apartmentId, optionId);

    return mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andReturn();
  }

  // =====================================================================
  // Happy path
  // =====================================================================

  @Test
  void vote_happyPath_retorna201_egravaVoto() throws Exception {
    UUID condoId = insertCondo("Condo Vote Happy");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.pollId").value(pollId))
        .andExpect(jsonPath("$.apartmentId").value(aptId.toString()))
        .andExpect(jsonPath("$.optionId").value(optionId.toString()))
        .andExpect(jsonPath("$.votedAt").isNotEmpty());

    Integer count =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM vote WHERE poll_id = ?::uuid", Integer.class, pollId);
    assertEquals(1, count);
  }

  // =====================================================================
  // Auditoria
  // =====================================================================

  @Test
  void vote_audit_VOTE_CAST_publicado() throws Exception {
    UUID condoId = insertCondo("Condo Vote Audit");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);
    MvcResult result = votar(pollId, condoId, voterUserId, aptId, optionId);
    assertEquals(201, result.getResponse().getStatus());

    String voteId =
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();

    var row =
        jdbc.queryForMap(
            "SELECT event_type, payload FROM audit_event WHERE entity_id = ?::uuid"
                + " ORDER BY occurred_at DESC LIMIT 1",
            UUID.fromString(voteId));

    assertEquals("VOTE_CAST", row.get("event_type"));
    String payload = row.get("payload").toString();
    assertTrue(payload.contains("bulkOperation"), "payload deve conter bulkOperation");
    assertTrue(payload.contains("false"), "bulkOperation deve ser false por padrão");
  }

  @Test
  void vote_bulkHeader_setaPayload() throws Exception {
    UUID condoId = insertCondo("Condo Vote Bulk");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    MvcResult result =
        mvc.perform(
                post("/api/polls/{pollId}/vote", pollId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Tenant-Id", condoId.toString())
                    .header("X-Bulk-Operation", "true")
                    .content(
                        """
                        {"apartmentId": "%s", "optionId": "%s"}
                        """
                            .formatted(aptId, optionId))
                    .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
            .andExpect(status().isCreated())
            .andReturn();

    String voteId =
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();

    var row =
        jdbc.queryForMap(
            "SELECT payload FROM audit_event WHERE entity_id = ?::uuid"
                + " ORDER BY occurred_at DESC LIMIT 1",
            UUID.fromString(voteId));

    String payload = row.get("payload").toString();
    assertTrue(payload.contains("bulkOperation"), "payload deve conter bulkOperation");
    assertTrue(payload.contains("true"), "bulkOperation deve ser true quando header enviado");
  }

  // =====================================================================
  // Estados inválidos da poll
  // =====================================================================

  @Test
  void vote_pollDraft_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Vote Draft");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    // poll em DRAFT — não aberta
    UUID optionId = getFirstOptionId(pollId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isConflict());
  }

  @Test
  void vote_pollScheduled_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Vote Scheduled");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    // poll em SCHEDULED — não aberta
    UUID optionId = getFirstOptionId(pollId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isConflict());
  }

  @Test
  void vote_pollClosed_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Vote Closed");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // fechar poll manualmente
    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());

    UUID optionId = getFirstOptionId(pollId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isConflict());
  }

  @Test
  void vote_pollCancelled_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Vote Cancelled");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);

    // cancelar poll
    mvc.perform(
            post("/api/polls/{id}/cancel", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"reason": "Cancelamento de teste obrigatório"}
                    """)
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());

    UUID optionId = getFirstOptionId(pollId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isConflict());
  }

  // =====================================================================
  // Duplicidade
  // =====================================================================

  @Test
  void vote_duplicado_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Vote Dup");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    // primeiro voto — sucesso
    MvcResult first = votar(pollId, condoId, voterUserId, aptId, optionId);
    assertEquals(201, first.getResponse().getStatus());

    // segundo voto — mesmo apartamento → conflito
    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isConflict());
  }

  // =====================================================================
  // Elegibilidade / autorização
  // =====================================================================

  @Test
  void vote_aptInadimplente_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo Vote Inadimplente");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    // Apto elegível para abrir a poll (precisa de ao menos 1)
    UUID voterElegivel = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterElegivel);

    // Apto inadimplente que tentará votar
    UUID voterInadimplente = UuidV7.generate();
    UUID aptInadimplente = insertApartmentInadimplente(condoId, "102", voterInadimplente);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptInadimplente, optionId))
                .with(jwt().jwt(b -> b.subject(voterInadimplente.toString()))))
        .andExpect(status().isForbidden());
  }

  @Test
  void vote_userDiferenteDoEligible_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo Vote User Errado");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    // Usuário diferente do eligible_voter_user_id do snapshot, mas pertence ao condo
    UUID outroUser = UuidV7.generate();
    UUID outroApt = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at)"
            + " VALUES (?, ?, ?, false, now())",
        outroApt,
        condoId,
        "999");
    insertResident(condoId, outroApt, outroUser, "OWNER");

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionId))
                .with(jwt().jwt(b -> b.subject(outroUser.toString()))))
        .andExpect(status().isForbidden());
  }

  // =====================================================================
  // Opção inválida
  // =====================================================================

  @Test
  void vote_optionDeOutraPoll_retorna422() throws Exception {
    UUID condoId = insertCondo("Condo Vote Option Errada");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    // Poll A
    String pollIdA = criarDraftPoll(condoId, adminId);
    publicarPoll(pollIdA, condoId, adminId);
    abrirPoll(pollIdA, condoId, adminId);

    // Poll B
    String pollIdB = criarDraftPoll(condoId, adminId);
    // opção da poll B
    UUID optionDaPollB = getFirstOptionId(pollIdB);

    // Tentar votar na poll A com opção da poll B
    mvc.perform(
            post("/api/polls/{pollId}/vote", pollIdA)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptId, optionDaPollB))
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isUnprocessableEntity());
  }

  // =====================================================================
  // Cross-tenant / RLS
  // =====================================================================

  @Test
  void vote_crossTenant_retorna403() throws Exception {
    UUID condoA = insertCondo("Condo A Cross");
    UUID condoB = insertCondo("Condo B Cross");
    UUID adminA = UuidV7.generate();
    UUID adminB = UuidV7.generate();
    insertAdmin(condoA, adminA);
    insertAdmin(condoB, adminB);

    UUID voterA = UuidV7.generate();
    UUID aptA = insertApartmentEligivel(condoA, "101", voterA);

    // Cria poll no condo A
    String pollIdA = criarDraftPoll(condoA, adminA);
    publicarPoll(pollIdA, condoA, adminA);
    abrirPoll(pollIdA, condoA, adminA);
    UUID optionIdA = getFirstOptionId(pollIdA);

    // Morador do condo B (voterA) tenta votar na poll do condo A
    // mas envia X-Tenant-Id = condoB → RLS esconde a poll
    mvc.perform(
            post("/api/polls/{pollId}/vote", pollIdA)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoB.toString())
                .content(
                    """
                    {"apartmentId": "%s", "optionId": "%s"}
                    """
                        .formatted(aptA, optionIdA))
                .with(jwt().jwt(b -> b.subject(voterA.toString()))))
        .andExpect(status().isForbidden());
  }

  // =====================================================================
  // Imutabilidade do voto
  // =====================================================================

  @Test
  void vote_imutabilidade_updateFalha() throws Exception {
    UUID condoId = insertCondo("Condo Vote Imutavel");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    MvcResult result = votar(pollId, condoId, voterUserId, aptId, optionId);
    assertEquals(201, result.getResponse().getStatus());

    String voteId =
        objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();

    // Obter outra opção para tentar alterar
    UUID outraOption =
        jdbc.queryForObject(
            "SELECT id FROM poll_option WHERE poll_id = ?::uuid AND id != ?::uuid"
                + " ORDER BY display_order LIMIT 1",
            UUID.class,
            pollId,
            optionId.toString());

    assertThrows(
        DataAccessException.class,
        () ->
            jdbc.update(
                "UPDATE vote SET poll_option_id = ?::uuid WHERE id = ?::uuid",
                outraOption,
                UUID.fromString(voteId)),
        "UPDATE direto no voto deve ser rejeitado pelo banco");
  }

  // =====================================================================
  // Auto-close quando todos os elegíveis votaram
  // =====================================================================

  @Test
  void vote_ultimoVotoFechaPoll_automatic() throws Exception {
    UUID condoId = insertCondo("Condo Vote Auto Close");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    // Apenas 1 apartamento elegível → snapshot_size=1; 1 voto fecha automaticamente
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);

    // Único voto → deve disparar auto-close
    MvcResult result = votar(pollId, condoId, voterUserId, aptId, optionId);
    assertEquals(201, result.getResponse().getStatus());

    // Poll deve estar CLOSED após auto-close
    String pollStatus =
        jdbc.queryForObject("SELECT status FROM poll WHERE id = ?::uuid", String.class, pollId);
    assertEquals("CLOSED", pollStatus, "Poll deve estar CLOSED após todos votarem");

    // poll_result deve existir com close_trigger = AUTOMATIC_ALL_VOTED
    String closeTrigger =
        jdbc.queryForObject(
            "SELECT close_trigger FROM poll_result WHERE poll_id = ?::uuid", String.class, pollId);
    assertEquals("AUTOMATIC_ALL_VOTED", closeTrigger, "close_trigger deve ser AUTOMATIC_ALL_VOTED");

    // Auditoria POLL_CLOSED com automatic=true deve existir
    var auditRows =
        jdbc.queryForList(
            "SELECT payload FROM audit_event WHERE entity_id = ?::uuid AND event_type = 'POLL_CLOSED'"
                + " ORDER BY occurred_at DESC LIMIT 1",
            pollId);
    assertTrue(!auditRows.isEmpty(), "Deve existir auditoria POLL_CLOSED");
    String payload = auditRows.get(0).get("payload").toString();
    assertTrue(payload.contains("automatic"), "payload deve conter campo automatic");
    assertTrue(payload.contains("true"), "automatic deve ser true no auto-close");
  }
}
