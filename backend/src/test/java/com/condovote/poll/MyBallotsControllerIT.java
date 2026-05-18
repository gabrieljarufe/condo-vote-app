package com.condovote.poll;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Tag("integration")
@SpringBootTest
@Transactional
class MyBallotsControllerIT extends AbstractIntegrationTest {

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

  // --- utilitários de fixture ---

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

  private void publicarPoll(String pollId, UUID condoId, UUID adminId) throws Exception {
    mvc.perform(
            post("/api/polls/{id}/publish", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());
  }

  private void abrirPoll(String pollId, UUID condoId, UUID adminId) throws Exception {
    mvc.perform(
            post("/api/polls/{id}/open", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());
  }

  private UUID insertApartmentEligivel(UUID condoId, String unit, UUID voterUserId) {
    UUID aptId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent,"
            + " eligible_voter_user_id, created_at) VALUES (?, ?, ?, false, ?, now())",
        aptId,
        condoId,
        unit,
        voterUserId);
    insertResident(condoId, aptId, voterUserId, "OWNER");
    return aptId;
  }

  private UUID insertApartmentElegivelComBlock(
      UUID condoId, String block, String unit, UUID voterUserId) {
    UUID aptId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, block, unit_number, is_delinquent,"
            + " eligible_voter_user_id, created_at) VALUES (?, ?, ?, ?, false, ?, now())",
        aptId,
        condoId,
        block,
        unit,
        voterUserId);
    insertResident(condoId, aptId, voterUserId, "OWNER");
    return aptId;
  }

  private UUID getFirstOptionId(String pollId) {
    return jdbc.queryForObject(
        "SELECT id FROM poll_option WHERE poll_id = ?::uuid ORDER BY display_order LIMIT 1",
        UUID.class,
        pollId);
  }

  private void votar(String pollId, UUID condoId, UUID voterUserId, UUID apartmentId, UUID optionId)
      throws Exception {
    String body =
        """
        {"apartmentId": "%s", "optionId": "%s"}
        """
            .formatted(apartmentId, optionId);

    mvc.perform(
            post("/api/polls/{pollId}/vote", pollId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(body)
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isCreated());
  }

  // =====================================================================
  // my-ballots — cenários
  // =====================================================================

  @Test
  void myBallots_userSemCedulasNaPoll_retornaEmpty() throws Exception {
    UUID condoId = insertCondo("Condo MyBallots Empty");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    // Apto elegível com outro usuário (para poll ter snapshot e poder ser aberta)
    UUID outroVoter = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", outroVoter);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // Usuário sem cédula na poll
    UUID semCedula = UuidV7.generate();
    UUID semCedulaApt = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at)"
            + " VALUES (?, ?, ?, false, now())",
        semCedulaApt,
        condoId,
        "999");
    insertResident(condoId, semCedulaApt, semCedula, "OWNER");

    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(semCedula.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void myBallots_userCom1AptElegivel_retornaUmaEntry() throws Exception {
    UUID condoId = insertCondo("Condo MyBallots 1 Apto");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].alreadyVoted").value(false))
        .andExpect(jsonPath("$[0].votedOptionId").isEmpty());
  }

  @Test
  void myBallots_userJaVotou_alreadyVotedTrue() throws Exception {
    UUID condoId = insertCondo("Condo MyBallots Votou");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);
    votar(pollId, condoId, voterUserId, aptId, optionId);

    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].alreadyVoted").value(true))
        .andExpect(jsonPath("$[0].votedOptionId").value(optionId.toString()));
  }

  @Test
  void myBallots_userComNAptos_retornaTodos() throws Exception {
    UUID condoId = insertCondo("Condo MyBallots N Aptos");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    UUID apt1 = insertApartmentEligivel(condoId, "101", voterUserId);
    UUID apt2 = insertApartmentEligivel(condoId, "102", voterUserId);
    UUID apt3 = insertApartmentEligivel(condoId, "103", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);
    // Vota apenas no primeiro apto
    votar(pollId, condoId, voterUserId, apt1, optionId);

    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(3)))
        .andExpect(jsonPath("$[0].alreadyVoted").value(true))
        .andExpect(jsonPath("$[1].alreadyVoted").value(false))
        .andExpect(jsonPath("$[2].alreadyVoted").value(false));
  }

  @Test
  void myBallots_naoVazaDeOutroUser() throws Exception {
    UUID condoId = insertCondo("Condo MyBallots Cross User");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID userA = UuidV7.generate();
    UUID userB = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", userA);
    insertApartmentEligivel(condoId, "102", userB);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // JWT do usuário A — deve ver apenas o apto 101
    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userA.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].apartmentLabel").value("101"));
  }

  @Test
  void myBallots_apartmentLabel_formatado() throws Exception {
    UUID condoId = insertCondo("Condo MyBallots Label");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterComBlock = UuidV7.generate();
    UUID voterSemBlock = UuidV7.generate();
    insertApartmentElegivelComBlock(condoId, "A", "101", voterComBlock);
    insertApartmentEligivel(condoId, "202", voterSemBlock);

    // Cria uma poll para cada usuário (poll A para voterComBlock, poll B para voterSemBlock)
    // Para simplificar, usamos 2 polls distintas

    // Poll para voterComBlock
    String pollIdA = criarDraftPoll(condoId, adminId);
    publicarPoll(pollIdA, condoId, adminId);
    abrirPoll(pollIdA, condoId, adminId);

    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollIdA)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterComBlock.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].apartmentLabel").value("A 101"));

    // Poll para voterSemBlock
    String pollIdB = criarDraftPoll(condoId, adminId);
    publicarPoll(pollIdB, condoId, adminId);
    abrirPoll(pollIdB, condoId, adminId);

    mvc.perform(
            get("/api/polls/{pollId}/my-ballots", pollIdB)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterSemBlock.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].apartmentLabel").value("202"));
  }

  // =====================================================================
  // my-pending-polls — cenários
  // =====================================================================

  @Test
  void myPending_userSemCedulas_retornaEmpty() throws Exception {
    UUID condoId = insertCondo("Condo MyPending Empty");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID outroVoter = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", outroVoter);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID semCedula = UuidV7.generate();
    UUID semCedulaApt = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at)"
            + " VALUES (?, ?, ?, false, now())",
        semCedulaApt,
        condoId,
        "999");
    insertResident(condoId, semCedulaApt, semCedula, "OWNER");

    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(semCedula.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void myPending_pollOpenComCedulaPendente_retornaPoll() throws Exception {
    UUID condoId = insertCondo("Condo MyPending Open");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].pollId").value(pollId))
        .andExpect(jsonPath("$[0].pendingBallotsCount").value(1))
        .andExpect(jsonPath("$[0].totalBallotsCount").value(1));
  }

  @Test
  void myPending_pollOpenJaVotado_naoAparece() throws Exception {
    UUID condoId = insertCondo("Condo MyPending Votado");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    UUID aptId = insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    UUID optionId = getFirstOptionId(pollId);
    votar(pollId, condoId, voterUserId, aptId, optionId);

    // Após votar a única cédula, a poll não deve aparecer em pending
    // Nota: o auto-close pode ter fechado a poll; mas o filtro status=OPEN já excluiria
    // Verificamos via direto (se ainda OPEN) — no caso de auto-close, verifica que retorna empty
    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void myPending_pollDraft_naoAparece() throws Exception {
    UUID condoId = insertCondo("Condo MyPending Draft");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    // Poll em DRAFT — não publicada, não aberta
    criarDraftPoll(condoId, adminId);

    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void myPending_pollScheduled_naoAparece() throws Exception {
    UUID condoId = insertCondo("Condo MyPending Scheduled");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    // Poll em SCHEDULED — não aberta

    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void myPending_pollClosed_naoAparece() throws Exception {
    UUID condoId = insertCondo("Condo MyPending Closed");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);

    UUID voterUserId = UuidV7.generate();
    insertApartmentEligivel(condoId, "101", voterUserId);

    String pollId = criarDraftPoll(condoId, adminId);
    publicarPoll(pollId, condoId, adminId);
    abrirPoll(pollId, condoId, adminId);

    // Fechar manualmente
    mvc.perform(
            post("/api/polls/{id}/close", pollId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(adminId.toString()))))
        .andExpect(status().isOk());

    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoId)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(voterUserId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void myPending_crossTenant_naoVaza() throws Exception {
    UUID condoA = insertCondo("Condo A MyPending Cross");
    UUID condoB = insertCondo("Condo B MyPending Cross");
    UUID adminA = UuidV7.generate();
    UUID adminB = UuidV7.generate();
    insertAdmin(condoA, adminA);
    insertAdmin(condoB, adminB);

    UUID voterA = UuidV7.generate();
    insertApartmentEligivel(condoA, "101", voterA);

    // Poll aberta no condo A
    String pollIdA = criarDraftPoll(condoA, adminA);
    publicarPoll(pollIdA, condoA, adminA);
    abrirPoll(pollIdA, condoA, adminA);

    // voterA envia X-Tenant-Id do condo B — RLS deve esconder polls do condo A
    // O usuário precisa pertencer ao condo B para passar no TenantInterceptor
    UUID aptB = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at)"
            + " VALUES (?, ?, ?, false, now())",
        aptB,
        condoB,
        "201");
    insertResident(condoB, aptB, voterA, "OWNER");

    mvc.perform(
            get("/api/condominiums/{condoId}/my-pending-polls", condoB)
                .header("X-Tenant-Id", condoB.toString())
                .with(jwt().jwt(b -> b.subject(voterA.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }
}
