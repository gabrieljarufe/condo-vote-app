package com.condovote.shared.scheduling;

import static org.assertj.core.api.Assertions.assertThat;

import com.condovote.AbstractIntegrationTest;
import com.condovote.poll.PollOpener;
import com.condovote.shared.UuidV7;
import com.condovote.shared.constants.SystemUser;
import com.condovote.shared.tenant.TenantContext;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@Tag("integration")
@SpringBootTest
@Transactional
class PollCloserJobIT extends AbstractIntegrationTest {

  @Autowired PollCloserJob job;
  @Autowired PollOpener pollOpener;

  // -------------------------------------------------------------------------
  // Utilitários de fixture
  // -------------------------------------------------------------------------

  /** Insere poll DRAFT + 2 opções via JDBC e retorna o id. */
  private UUID insertPollDraft(UUID condoId, UUID adminId) {
    UUID pollId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO poll (id, condominium_id, title, convocation, quorum_mode, status,"
            + " scheduled_start, scheduled_end, created_by_user_id, created_at, updated_at)"
            + " VALUES (?, ?, 'Votação Closer Test', 'FIRST', 'SIMPLE_MAJORITY', 'DRAFT',"
            + " now() - interval '2 hours', now() + interval '1 hour', ?, now(), now())",
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
    return pollId;
  }

  /** Insere apartamento elegível. */
  private void insertApartmentEligivel(UUID condoId, String unit) {
    UUID voterUserId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent,"
            + " eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, ?, false, ?, now())",
        UuidV7.generate(),
        condoId,
        unit,
        voterUserId);
  }

  /**
   * Publica poll DRAFT → SCHEDULED diretamente via SQL (sem verificação de scheduled_start). Usada
   * para poder chamar pollOpener.open() em seguida.
   */
  private void publishPoll(UUID pollId, UUID condoId) {
    // SET LOCAL app.current_tenant requerido apenas em transação; aqui usamos jdbc direto
    // (sem RLS — a poll foi inserida no mesmo @Transactional de teste).
    jdbc.update("UPDATE poll SET status = 'SCHEDULED', updated_at = now() WHERE id = ?", pollId);
  }

  /**
   * Abre uma poll via PollOpener (seta TenantContext + chama open()). Deve ser chamado dentro
   * de @Transactional existente do teste.
   */
  private void openPoll(UUID pollId, UUID condoId) {
    try {
      TenantContext.set(condoId);
      pollOpener.open(pollId, SystemUser.ID, false);
    } finally {
      TenantContext.clear();
    }
  }

  /** Reposiciona scheduled_end no passado para que o closer job processe a poll. */
  private void expirarScheduledEnd(UUID pollId) {
    jdbc.update(
        "UPDATE poll SET scheduled_end = now() - interval '5 minutes' WHERE id = ?", pollId);
  }

  /** Lê o status atual de uma poll sem RLS (JdbcTemplate direto). */
  private String statusDaPoll(UUID pollId) {
    return jdbc.queryForObject("SELECT status FROM poll WHERE id = ?", String.class, pollId);
  }

  /** Verifica se há poll_result registrado para uma poll. */
  private boolean temPollResult(UUID pollId) {
    Integer count =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM poll_result WHERE poll_id = ?", Integer.class, pollId);
    return count != null && count > 0;
  }

  /** Conta audit_events para uma poll com o event_type fornecido. */
  @SuppressWarnings("unused")
  private int auditCount(UUID pollId, UUID condoId, String eventType) {
    // Sem RLS: query direta sem setar tenant. A coluna event_type é enum —
    // usa cast explícito ::text para evitar erro de tipo no driver JDBC.
    Integer count =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM audit_event" + " WHERE entity_id = ? AND event_type::text = ?",
            Integer.class,
            pollId,
            eventType);
    return count != null ? count : 0;
  }

  // =========================================================================
  // Cenários
  // =========================================================================

  @Test
  void job_fechaPollsAbertasVencidas() {
    // Arrange: 2 condos com 1 poll OPEN cada, scheduled_end no passado (sem votos → INVALIDATED)
    UUID condoId1 = insertCondo("Condo Job Closer A");
    UUID adminId1 = UuidV7.generate();
    insertAdmin(condoId1, adminId1);
    insertApartmentEligivel(condoId1, "101");
    UUID pollId1 = insertPollDraft(condoId1, adminId1);
    publishPoll(pollId1, condoId1);
    openPoll(pollId1, condoId1);
    expirarScheduledEnd(pollId1);

    UUID condoId2 = insertCondo("Condo Job Closer B");
    UUID adminId2 = UuidV7.generate();
    insertAdmin(condoId2, adminId2);
    insertApartmentEligivel(condoId2, "201");
    UUID pollId2 = insertPollDraft(condoId2, adminId2);
    publishPoll(pollId2, condoId2);
    openPoll(pollId2, condoId2);
    expirarScheduledEnd(pollId2);

    // Act
    job.closeOpenPolls();

    // Assert: ambas as polls transitaram para CLOSED ou INVALIDATED (sem votos → INVALIDATED)
    assertThat(statusDaPoll(pollId1)).isIn("CLOSED", "INVALIDATED");
    assertThat(statusDaPoll(pollId2)).isIn("CLOSED", "INVALIDATED");

    // poll_result inserido para as duas
    assertThat(temPollResult(pollId1)).isTrue();
    assertThat(temPollResult(pollId2)).isTrue();
  }

  @Test
  void job_ignoraPollsAbertasNaoVencidas() {
    // Arrange: poll OPEN com scheduled_end no futuro
    UUID condoId = insertCondo("Condo Job Closer Nao Vencida");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    insertApartmentEligivel(condoId, "101");
    UUID pollId = insertPollDraft(condoId, adminId);
    publishPoll(pollId, condoId);
    openPoll(pollId, condoId);
    // scheduled_end permanece no futuro (setado pelo insertPollDraft como now() + 1h)

    // Act
    job.closeOpenPolls();

    // Assert: poll permanece OPEN
    assertThat(statusDaPoll(pollId)).isEqualTo("OPEN");
    assertThat(temPollResult(pollId)).isFalse();
  }

  @Test
  void job_pollComStatusErrado_naoAfetada() {
    // Arrange: polls SCHEDULED e DRAFT — nenhuma deve ser tocada pelo PollCloserJob
    UUID condoId = insertCondo("Condo Job Closer Status Errado");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    insertApartmentEligivel(condoId, "101");

    UUID pollDraftId = insertPollDraft(condoId, adminId);

    // A poll SCHEDULED foi publicada mas não aberta
    UUID pollScheduledId = insertPollDraft(condoId, adminId);
    publishPoll(pollScheduledId, condoId);
    // expirar scheduled_end para tentar enganar o job
    expirarScheduledEnd(pollScheduledId);

    // Act
    job.closeOpenPolls();

    // Assert: nenhuma das polls foi alterada
    assertThat(statusDaPoll(pollDraftId)).isEqualTo("DRAFT");
    assertThat(statusDaPoll(pollScheduledId)).isEqualTo("SCHEDULED");
    assertThat(temPollResult(pollDraftId)).isFalse();
    assertThat(temPollResult(pollScheduledId)).isFalse();
  }

  /** Verifica que o job não encontra candidatos quando não há polls elegíveis. */
  @Test
  void job_semCandidatos_executaSemErro() {
    // Arrange: nenhuma poll inserida

    // Act + Assert: deve executar sem exceção
    job.closeOpenPolls();
  }
}
