package com.condovote.shared.scheduling;

import static org.assertj.core.api.Assertions.assertThat;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@Tag("integration")
@SpringBootTest
@Transactional
class PollOpenerJobIT extends AbstractIntegrationTest {

  @Autowired PollOpenerJob job;

  // -------------------------------------------------------------------------
  // Utilitários de fixture
  // -------------------------------------------------------------------------

  /** Insere uma poll com status e scheduled_start via JDBC (sem RLS: fora de tenant). */
  private UUID insertPoll(
      UUID condoId, UUID adminId, String status, OffsetDateTime scheduledStart) {
    UUID pollId = UuidV7.generate();
    // Inline do cast de enum no SQL; scheduledStart passado como parâmetro tipado.
    jdbc.update(
        "INSERT INTO poll (id, condominium_id, title, convocation, quorum_mode, status,"
            + " scheduled_start, scheduled_end, created_by_user_id, created_at, updated_at)"
            + " VALUES (?, ?, 'Votação Job Test', 'FIRST'::convocation_type,"
            + " 'SIMPLE_MAJORITY'::quorum_mode, '"
            + status
            + "'::poll_status,"
            + " ?, now() + interval '2 hours', ?, now(), now())",
        pollId,
        condoId,
        scheduledStart,
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

  private OffsetDateTime pastTime(int minusMinutes) {
    return OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(minusMinutes);
  }

  private OffsetDateTime futureTime(int plusMinutes) {
    return OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(plusMinutes);
  }

  /** Insere apartamento elegível (eligible_voter_user_id definido, não inadimplente). */
  private UUID insertApartmentEligivel(UUID condoId, String unit) {
    UUID aptId = UuidV7.generate();
    UUID voterUserId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent,"
            + " eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, ?, false, ?, now())",
        aptId,
        condoId,
        unit,
        voterUserId);
    return aptId;
  }

  /** Lê o status atual de uma poll sem RLS (JdbcTemplate direto). */
  private String statusDaPoll(UUID pollId) {
    return jdbc.queryForObject("SELECT status FROM poll WHERE id = ?", String.class, pollId);
  }

  /** Conta entradas no snapshot de elegibilidade para uma poll. */
  private int snapshotCount(UUID pollId) {
    Integer count =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM poll_eligible_snapshot WHERE poll_id = ?", Integer.class, pollId);
    return count != null ? count : 0;
  }

  /** Conta audit_events para uma poll com o event_type fornecido. */
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
  void job_abrePollsAgendadasVencidas() {
    // Arrange: 2 condos distintos, cada um com 1 poll SCHEDULED no passado e apartamento elegível
    UUID condoId1 = insertCondo("Condo Job Opener A");
    UUID adminId1 = UuidV7.generate();
    insertAdmin(condoId1, adminId1);
    insertApartmentEligivel(condoId1, "101");
    UUID pollId1 = insertPoll(condoId1, adminId1, "SCHEDULED", pastTime(10));

    UUID condoId2 = insertCondo("Condo Job Opener B");
    UUID adminId2 = UuidV7.generate();
    insertAdmin(condoId2, adminId2);
    insertApartmentEligivel(condoId2, "201");
    UUID pollId2 = insertPoll(condoId2, adminId2, "SCHEDULED", pastTime(5));

    // Act
    job.openScheduledPolls();

    // Assert: ambas as polls agora OPEN
    assertThat(statusDaPoll(pollId1)).isEqualTo("OPEN");
    assertThat(statusDaPoll(pollId2)).isEqualTo("OPEN");

    // Snapshot populado para as duas
    assertThat(snapshotCount(pollId1)).isGreaterThan(0);
    assertThat(snapshotCount(pollId2)).isGreaterThan(0);

    // Audit POLL_OPENED_AUTO registrado para as duas
    assertThat(auditCount(pollId1, condoId1, "POLL_OPENED_AUTO")).isEqualTo(1);
    assertThat(auditCount(pollId2, condoId2, "POLL_OPENED_AUTO")).isEqualTo(1);
  }

  @Test
  void job_ignoraPollsAgendadasFuturas() {
    // Arrange: poll SCHEDULED com scheduled_start no futuro
    UUID condoId = insertCondo("Condo Job Opener Futuro");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    insertApartmentEligivel(condoId, "101");
    UUID pollId = insertPoll(condoId, adminId, "SCHEDULED", futureTime(60));

    // Act
    job.openScheduledPolls();

    // Assert: poll continua SCHEDULED
    assertThat(statusDaPoll(pollId)).isEqualTo("SCHEDULED");
    assertThat(snapshotCount(pollId)).isEqualTo(0);
  }

  @Test
  void job_falhaEmUmaPollNaoBloqueiaOutras() {
    // Arrange: 2 polls expiradas; a primeira sem apartamentos elegíveis (vai dar 422)
    UUID condoId1 = insertCondo("Condo Job Opener Sem Apto");
    UUID adminId1 = UuidV7.generate();
    insertAdmin(condoId1, adminId1);
    // sem insertApartmentEligivel → snapshot vazio → UnprocessableEntityException
    UUID pollIdFalha = insertPoll(condoId1, adminId1, "SCHEDULED", pastTime(10));

    UUID condoId2 = insertCondo("Condo Job Opener Com Apto");
    UUID adminId2 = UuidV7.generate();
    insertAdmin(condoId2, adminId2);
    insertApartmentEligivel(condoId2, "101");
    // Insere SCHEDULED com scheduled_start mais recente que a poll sem apto
    UUID pollIdOk = insertPoll(condoId2, adminId2, "SCHEDULED", pastTime(5));

    // Act: job processa; a primeira falha mas não bloqueia a segunda
    job.openScheduledPolls();

    // Assert: poll com falha continua SCHEDULED (retry na próxima execução do job)
    assertThat(statusDaPoll(pollIdFalha)).isEqualTo("SCHEDULED");

    // Assert: poll OK foi aberta
    assertThat(statusDaPoll(pollIdOk)).isEqualTo("OPEN");
    assertThat(snapshotCount(pollIdOk)).isGreaterThan(0);
  }

  @Test
  void job_pollComStatusErrado_naoAfetada() {
    // Arrange: polls DRAFT e OPEN — nenhuma deve ser tocada pelo PollOpenerJob
    UUID condoId = insertCondo("Condo Job Opener Status Errado");
    UUID adminId = UuidV7.generate();
    insertAdmin(condoId, adminId);
    insertApartmentEligivel(condoId, "101");

    UUID pollDraftId = insertPoll(condoId, adminId, "DRAFT", pastTime(60));

    // Act
    job.openScheduledPolls();

    // Assert: poll DRAFT não foi alterada
    assertThat(statusDaPoll(pollDraftId)).isEqualTo("DRAFT");
    assertThat(snapshotCount(pollDraftId)).isEqualTo(0);
    assertThat(auditCount(pollDraftId, condoId, "POLL_OPENED_AUTO")).isEqualTo(0);
  }

  /** Verifica que o job não encontra candidatos quando não há polls elegíveis. */
  @Test
  void job_semCandidatos_executaSemErro() {
    // Arrange: nenhuma poll inserida

    // Act + Assert: deve executar sem exceção
    job.openScheduledPolls();
  }
}
