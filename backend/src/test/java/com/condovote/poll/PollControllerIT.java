package com.condovote.poll;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class PollControllerIT extends AbstractIntegrationTest {

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

  private String pastDate(int minusHours) {
    return OffsetDateTime.now(ZoneOffset.UTC)
        .minusHours(minusHours)
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

  /** Insere apartamento com eligible_voter_user_id definido (necessário para snapshot). */
  private UUID insertApartmentEligivel(UUID condoId, String unit, UUID voterUserId) {
    UUID aptId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, ?, false, ?, now())",
        aptId,
        condoId,
        unit,
        voterUserId);
    return aptId;
  }

  /** Insere apartamento inadimplente com eligible_voter_user_id (não entra no snapshot). */
  private UUID insertApartmentInadimplente(UUID condoId, String unit, UUID voterUserId) {
    UUID aptId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, ?, true, ?, now())",
        aptId,
        condoId,
        unit,
        voterUserId);
    return aptId;
  }

  /** Abre um poll SCHEDULED via HTTP. */
  private void abrirPoll(String pollId, UUID condoId, UUID adminId) throws Exception {
    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());
  }

  // =====================================================================
  // Auth / Autorização
  // =====================================================================

  @Test
  void create_semAutorizacao_retorna401() throws Exception {
    UUID condoId = insertCondo("Condo 401");
    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"T","convocation":"FIRST","quorumMode":"SIMPLE_MAJORITY",
                     "scheduledStart":"2030-01-01T10:00:00Z","scheduledEnd":"2030-01-01T12:00:00Z",
                     "options":["Sim","Não"]}
                    """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void create_naoAdmin_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo 403");
    UUID residentId = UuidV7.generate();
    UUID aptId = insertApartment(condoId, "101");
    insertAdmin(condoId, UuidV7.generate());
    insertResident(condoId, aptId, residentId, "OWNER");

    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"title":"T","convocation":"FIRST","quorumMode":"SIMPLE_MAJORITY",
                     "scheduledStart":"2030-01-01T10:00:00Z","scheduledEnd":"2030-01-01T12:00:00Z",
                     "options":["Sim","Não"]}
                    """)
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isForbidden());
  }

  // =====================================================================
  // CreateDraft (POST /condominiums/{id}/polls)
  // =====================================================================

  @Test
  void create_happyPath_retorna201() throws Exception {
    UUID condoId = insertCondo("Condo Create");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Aprovação de Obras",
                      "description": "Reforma do hall de entrada",
                      "convocation": "FIRST",
                      "quorumMode": "SIMPLE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["Sim", "Não"]
                    }
                    """
                        .formatted(futureDate(1), futureDate(2)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.status").value("DRAFT"))
        .andExpect(jsonPath("$.eligibleCount").isEmpty())
        .andExpect(jsonPath("$.title").value("Aprovação de Obras"));
  }

  @Test
  void create_opcoesDuplicadas_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Dup");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Votação",
                      "convocation": "FIRST",
                      "quorumMode": "SIMPLE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["Sim", "Sim"]
                    }
                    """
                        .formatted(futureDate(1), futureDate(2)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void create_menosDe2Opcoes_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Min Opcoes");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Votação",
                      "convocation": "FIRST",
                      "quorumMode": "SIMPLE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["Sim"]
                    }
                    """
                        .formatted(futureDate(1), futureDate(2)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void create_mais10Opcoes_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Max Opcoes");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Votação",
                      "convocation": "FIRST",
                      "quorumMode": "SIMPLE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["A","B","C","D","E","F","G","H","I","J","K"]
                    }
                    """
                        .formatted(futureDate(1), futureDate(2)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void create_dataFimAntesDeInicio_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Data Fim");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    mvc.perform(
            post("/api/condominiums/{condoId}/polls", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Votação",
                      "convocation": "FIRST",
                      "quorumMode": "SIMPLE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["Sim", "Não"]
                    }
                    """
                        // fim antes do início
                        .formatted(futureDate(2), futureDate(1)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isBadRequest());
  }

  // =====================================================================
  // UpdateDraft (PUT /polls/{id})
  // =====================================================================

  @Test
  void update_emDraft_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Update Draft");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);

    mvc.perform(
            put("/api/polls/{id}", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Título Atualizado",
                      "convocation": "SECOND",
                      "quorumMode": "ABSOLUTE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["Aprovar", "Rejeitar", "Abstencão"]
                    }
                    """
                        .formatted(futureDate(3), futureDate(4)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Título Atualizado"))
        .andExpect(jsonPath("$.status").value("DRAFT"));
  }

  @Test
  void update_emOpen_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Update Open");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    // precisa de apartamento elegível para abrir
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            put("/api/polls/{id}", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {
                      "title": "Tentar Editar",
                      "convocation": "FIRST",
                      "quorumMode": "SIMPLE_MAJORITY",
                      "scheduledStart": "%s",
                      "scheduledEnd": "%s",
                      "options": ["Sim", "Não"]
                    }
                    """
                        .formatted(futureDate(1), futureDate(2)))
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isConflict());
  }

  // =====================================================================
  // Publish (POST /polls/{id}/publish)
  // =====================================================================

  @Test
  void publish_draftComStartFuturo_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Publish Future");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/publish", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("SCHEDULED"));
  }

  @Test
  void publish_draftComStartNoPassado_retorna422() throws Exception {
    UUID condoId = insertCondo("Condo Publish Past");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    // Cria poll com start no passado diretamente via SQL
    UUID pollId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO poll (id, condominium_id, title, convocation, quorum_mode, status,"
            + " scheduled_start, scheduled_end, created_by_user_id, created_at, updated_at)"
            + " VALUES (?, ?, 'Poll Passado', 'FIRST', 'SIMPLE_MAJORITY', 'DRAFT',"
            + " now() - interval '2 hours', now() - interval '1 hour', ?, now(), now())",
        pollId,
        condoId,
        adminId);
    jdbc.update(
        "INSERT INTO poll_option (id, poll_id, label, display_order) VALUES (?, ?, 'Sim', 0)",
        UuidV7.generate(),
        pollId);
    jdbc.update(
        "INSERT INTO poll_option (id, poll_id, label, display_order) VALUES (?, ?, 'Não', 1)",
        UuidV7.generate(),
        pollId);

    mvc.perform(
            post("/api/polls/{id}/publish", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void publish_emOpen_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Publish Open");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/publish", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isConflict());
  }

  // =====================================================================
  // Open (POST /polls/{id}/open)
  // =====================================================================

  @Test
  void open_scheduledComApartamentosElegiveis_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Open Elegivel");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("OPEN"))
        .andExpect(jsonPath("$.eligibleCount").value(greaterThanOrEqualTo(1)));
  }

  @Test
  void open_scheduledSemApartamentos_retorna422() throws Exception {
    UUID condoId = insertCondo("Condo Open Sem Aptos");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    // nenhum apartamento inserido

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void open_scheduledComApartamentoInadimplente_retorna422() throws Exception {
    UUID condoId = insertCondo("Condo Open Inadimplente");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    // único apartamento está inadimplente → snapshot será vazio
    insertApartmentInadimplente(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isUnprocessableEntity());
  }

  @Test
  void open_emDraft_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Open Draft");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);
    // poll está em DRAFT, não SCHEDULED → deve retornar conflito

    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isConflict());
  }

  // =====================================================================
  // Cancel (POST /polls/{id}/cancel)
  // =====================================================================

  @Test
  void cancel_emDraftComMotivo_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Cancel Draft");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/cancel", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"reason": "Decisão revogada pela administração"}
                    """)
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELLED"))
        .andExpect(jsonPath("$.cancellationReason").value("Decisão revogada pela administração"));
  }

  @Test
  void cancel_emScheduled_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Cancel Scheduled");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/cancel", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"reason": "Cancelamento antes da abertura"}
                    """)
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELLED"));
  }

  @Test
  void cancel_emOpen_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Cancel Open");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/cancel", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"reason": "Emergência que demanda suspensão imediata"}
                    """)
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELLED"));
  }

  @Test
  void cancel_emClosed_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Cancel Closed");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // fechar poll
    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());

    // tentar cancelar depois de fechada
    mvc.perform(
            post("/api/polls/{id}/cancel", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"reason": "Tentativa inválida de cancelar depois de fechada"}
                    """)
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isConflict());
  }

  @Test
  void cancel_motivoMenorQue10_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Cancel Motivo Curto");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/cancel", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"reason": "Curto"}
                    """)
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isBadRequest());
  }

  // =====================================================================
  // Close (POST /polls/{id}/close)
  // =====================================================================

  @Test
  void close_emOpen_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Close Open");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    // 1 apartamento elegível → eligibleCount=1, convocation=FIRST → precisa de 1 voto
    // mas não tem votos → INVALIDATED (quórum não atingido)
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("INVALIDATED"));
  }

  @Test
  void close_emClosed_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Close Closed");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // primeiro close
    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());

    // segundo close → conflito
    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isConflict());
  }

  // =====================================================================
  // List (GET /condominiums/{condoId}/polls)
  // =====================================================================

  @Test
  void list_paginado_retornaContent() throws Exception {
    UUID condoId = insertCondo("Condo List Pag");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    criarDraftPoll(condoId, adminId);
    criarDraftPoll(condoId, adminId);
    criarDraftPoll(condoId, adminId);

    mvc.perform(
            get("/api/condominiums/{condoId}/polls", condoId)
                .param("page", "0")
                .param("size", "2")
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.content", hasSize(2)));
  }

  @Test
  void list_filtroStatus_filtraCorretamente() throws Exception {
    UUID condoId = insertCondo("Condo List Filtro");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    // 2 DRAFT
    criarDraftPoll(condoId, adminId);
    criarDraftPoll(condoId, adminId);
    // 1 SCHEDULED
    String pollScheduled = criarDraftPoll(condoId, adminId);
    publicarPoll(pollScheduled, condoId, adminId);

    mvc.perform(
            get("/api/condominiums/{condoId}/polls", condoId)
                .param("status", "DRAFT")
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content", hasSize(2)));
  }

  // =====================================================================
  // GetById (GET /polls/{id})
  // =====================================================================

  @Test
  void getById_pollDraft_retornaDetalhes() throws Exception {
    UUID condoId = insertCondo("Condo GetById Draft");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    String pollId = criarDraftPoll(condoId, adminId);

    mvc.perform(
            get("/api/polls/{id}", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.poll.status").value("DRAFT"))
        .andExpect(jsonPath("$.options", hasSize(2)))
        .andExpect(jsonPath("$.result").isEmpty());
  }

  @Test
  void getById_pollClosed_retornaDetalhesComResult() throws Exception {
    UUID condoId = insertCondo("Condo GetById Closed");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());

    mvc.perform(
            get("/api/polls/{id}", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.poll.status").value("INVALIDATED"))
        .andExpect(jsonPath("$.result").isNotEmpty())
        .andExpect(jsonPath("$.result.invalidationReason").isNotEmpty());
  }

  // =====================================================================
  // Acesso de moradores (read-only)
  // =====================================================================

  @Test
  void list_residenteDoCondo_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Residente List");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID aptId = insertApartment(condoId, "101");
    insertResident(condoId, aptId, residentId, "OWNER");

    criarDraftPoll(condoId, adminId);

    mvc.perform(
            get("/api/condominiums/{condoId}/polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))));
  }

  @Test
  void getById_residenteDoCondo_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Residente GetById");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID aptId = insertApartment(condoId, "101");
    insertResident(condoId, aptId, residentId, "OWNER");

    String pollId = criarDraftPoll(condoId, adminId);

    mvc.perform(
            get("/api/polls/{id}", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.poll.title").value("Votação Teste"))
        .andExpect(jsonPath("$.options").isArray());
  }

  @Test
  void getById_naoMembro_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo NaoMembro GetById");
    UUID adminId = UuidV7.generate();
    UUID estranhoId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    String pollId = criarDraftPoll(condoId, adminId);

    // estranhoId não tem vínculo nenhum com condoId → 403
    mvc.perform(
            get("/api/polls/{id}", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(estranhoId.toString()))))
        .andExpect(status().isForbidden());
  }

  // =====================================================================
  // RLS / Cross-tenant
  // =====================================================================

  @Test
  void list_outroTenant_retorna403() throws Exception {
    UUID condoA = insertCondo("Condo A RLS");
    UUID condoB = insertCondo("Condo B RLS");
    UUID adminA = UuidV7.generate();
    UUID adminB = UuidV7.generate();
    insertAdmin(condoA, adminA);
    insertAdmin(condoB, adminB);

    criarDraftPoll(condoA, adminA);

    // adminB tenta listar polls do condoA → não é membro de A → 403
    mvc.perform(
            get("/api/condominiums/{condoId}/polls", condoA)
                .header("X-Tenant-Id", condoB.toString())
                .with(jwt().jwt(b -> b.subject(adminB.toString()))))
        .andExpect(status().isForbidden());
  }

  @Test
  void getById_outroTenant_retorna403ouNotFound() throws Exception {
    UUID condoA = insertCondo("Condo A GetById");
    UUID condoB = insertCondo("Condo B GetById");
    UUID adminA = UuidV7.generate();
    UUID adminB = UuidV7.generate();
    insertAdmin(condoA, adminA);
    insertAdmin(condoB, adminB);

    String pollId = criarDraftPoll(condoA, adminA);

    // adminB tenta buscar poll de condoA → não é membro de A → 403 ou 404
    MvcResult result =
        mvc.perform(
                get("/api/polls/{id}", pollId)
                    .header("X-Tenant-Id", condoB.toString())
                    .with(jwt().jwt(b -> b.subject(adminB.toString()))))
            .andReturn();

    int status = result.getResponse().getStatus();
    // Aceita 403 (ForbiddenException: não é admin do condomínio do poll)
    // ou 404 (RLS esconde o registro no banco)
    if (status != 403 && status != 404) {
      throw new AssertionError("Esperado 403 ou 404, mas recebeu: " + status);
    }
  }

  // =====================================================================
  // Write-once snapshot trigger
  // =====================================================================

  @Test
  void triggerWriteOnce_updateSnapshot_rejeitaDireto() throws Exception {
    UUID condoId = insertCondo("Condo Snapshot WriteOnce");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // Verificar que snapshot foi criado
    int count =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM poll_eligible_snapshot WHERE poll_id = ?::uuid",
            Integer.class,
            pollId);
    org.junit.jupiter.api.Assertions.assertTrue(count >= 1, "Snapshot deve ter pelo menos 1 linha");

    // Tentar UPDATE direto no snapshot — deve falhar com exceção de banco
    assertThrows(
        DataAccessException.class,
        () ->
            jdbc.update(
                "UPDATE poll_eligible_snapshot SET apartment_id = ? WHERE poll_id = ?::uuid",
                UuidV7.generate(),
                pollId),
        "UPDATE direto no snapshot deve ser rejeitado pelo banco");
  }

  // =====================================================================
  // Snapshot: validar contagem via JdbcTemplate
  // =====================================================================

  @Test
  void open_snapshotCountCorreto() throws Exception {
    UUID condoId = insertCondo("Condo Snapshot Count");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    // 2 apartamentos elegíveis + 1 inadimplente → snapshot deve ter 2
    insertApartmentEligivel(condoId, "101", UuidV7.generate());
    insertApartmentEligivel(condoId, "102", UuidV7.generate());
    insertApartmentInadimplente(condoId, "103", UuidV7.generate());

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    int snapshotCount =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM poll_eligible_snapshot WHERE poll_id = ?::uuid",
            Integer.class,
            pollId);
    org.junit.jupiter.api.Assertions.assertEquals(2, snapshotCount);
  }
}
