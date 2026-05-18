package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.annotation.Transactional;

@Tag("integration")
@SpringBootTest
@Transactional
class VoteRepositoryIT extends AbstractIntegrationTest {

  @Autowired VoteRepository voteRepository;

  private UUID condoId;
  private UUID pollId;
  private UUID optionAId;
  private UUID optionBId;
  private UUID apartmentAId;
  private UUID apartmentBId;
  private UUID apartmentCId;
  private UUID voterAId;
  private UUID voterBId;
  private UUID voterCId;

  @BeforeEach
  void setUp() {
    condoId = insertCondo("Condo Vote IT");

    // Insere poll diretamente via jdbc para satisfazer FK (sem precisar do fluxo completo).
    // eligible_count é obrigatório quando status=OPEN (chk_poll_eligible_count).
    pollId = UuidV7.generate();
    UUID adminId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO poll (id, condominium_id, title, convocation, quorum_mode, status,"
            + " scheduled_start, scheduled_end, eligible_count, opened_at, opened_by_user_id,"
            + " created_by_user_id, created_at, updated_at)"
            + " VALUES (?, ?, 'Poll Teste Vote', 'FIRST', 'SIMPLE_MAJORITY', 'OPEN',"
            + " now() - interval '1 hour', now() + interval '1 hour', 3, now(), ?, ?, now(), now())",
        pollId,
        condoId,
        adminId,
        adminId);

    // Insere opções
    optionAId = UuidV7.generate();
    optionBId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO poll_option (id, poll_id, label, display_order) VALUES (?, ?, 'Sim', 0)",
        optionAId,
        pollId);
    jdbc.update(
        "INSERT INTO poll_option (id, poll_id, label, display_order) VALUES (?, ?, 'Não', 1)",
        optionBId,
        pollId);

    // Insere apartamentos com eligible_voter_user_id
    voterAId = UuidV7.generate();
    voterBId = UuidV7.generate();
    voterCId = UuidV7.generate();

    apartmentAId = UuidV7.generate();
    apartmentBId = UuidV7.generate();
    apartmentCId = UuidV7.generate();

    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, '101', false, ?, now())",
        apartmentAId,
        condoId,
        voterAId);
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, '102', false, ?, now())",
        apartmentBId,
        condoId,
        voterBId);
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, eligible_voter_user_id, created_at)"
            + " VALUES (?, ?, '103', false, ?, now())",
        apartmentCId,
        condoId,
        voterCId);
  }

  /**
   * Insere um voto diretamente via jdbc. Spring Data JDBC interpreta @Id pré-setado como UPDATE
   * (isNew=false), então save() silenciosamente não insere. O projeto usa namedJdbc direto no
   * service layer — replicamos o mesmo padrão aqui.
   */
  private UUID insertVote(UUID optionId, UUID apartmentId, UUID voterUserId) {
    UUID voteId = UuidV7.generate();
    jdbc.update(
        "INSERT INTO vote (id, condominium_id, poll_id, poll_option_id, apartment_id,"
            + " voter_user_id, voted_at) VALUES (?, ?, ?, ?, ?, ?, now())",
        voteId,
        condoId,
        pollId,
        optionId,
        apartmentId,
        voterUserId);
    return voteId;
  }

  @Test
  void insertAndFindByPollIdAndApartmentId_retornaPresent() {
    insertVote(optionAId, apartmentAId, voterAId);

    Optional<Vote> found = voteRepository.findByPollIdAndApartmentId(pollId, apartmentAId);

    assertThat(found).isPresent();
    assertThat(found.get().pollOptionId()).isEqualTo(optionAId);
    assertThat(found.get().voterUserId()).isEqualTo(voterAId);
    assertThat(found.get().condominiumId()).isEqualTo(condoId);
  }

  @Test
  void findByPollIdAndApartmentId_naoExiste_retornaEmpty() {
    Optional<Vote> found = voteRepository.findByPollIdAndApartmentId(pollId, apartmentAId);

    assertThat(found).isEmpty();
  }

  @Test
  void countByPollId_zero_e_dois() {
    // Sem votos → 0
    long countZero = voteRepository.countByPollId(pollId);
    assertThat(countZero).isZero();

    // Insere 2 votos
    insertVote(optionAId, apartmentAId, voterAId);
    insertVote(optionBId, apartmentBId, voterBId);

    long countDois = voteRepository.countByPollId(pollId);
    assertThat(countDois).isEqualTo(2);
  }

  @Test
  void tallyByPollId_agregaPorOpcao() {
    // 2 votos para optionA, 1 voto para optionB
    insertVote(optionAId, apartmentAId, voterAId);
    insertVote(optionAId, apartmentBId, voterBId);
    insertVote(optionBId, apartmentCId, voterCId);

    List<VoteRepository.VoteTally> tally = voteRepository.tallyByPollId(pollId);

    assertThat(tally).hasSize(2);

    VoteRepository.VoteTally tallyA =
        tally.stream().filter(t -> t.optionId().equals(optionAId)).findFirst().orElseThrow();
    VoteRepository.VoteTally tallyB =
        tally.stream().filter(t -> t.optionId().equals(optionBId)).findFirst().orElseThrow();

    assertThat(tallyA.voteCount()).isEqualTo(2);
    assertThat(tallyB.voteCount()).isEqualTo(1);
  }

  @Test
  void findByPollId_retornaTodos() {
    insertVote(optionAId, apartmentAId, voterAId);
    insertVote(optionBId, apartmentBId, voterBId);

    List<Vote> votes = voteRepository.findByPollId(pollId);

    assertThat(votes).hasSize(2);
    assertThat(votes).extracting(Vote::pollId).containsOnly(pollId);
  }

  @Test
  void votoEhImutavel_updateFalha() {
    UUID voteId = insertVote(optionAId, apartmentAId, voterAId);

    assertThrows(
        DataAccessException.class,
        () -> jdbc.update("UPDATE vote SET poll_option_id = ? WHERE id = ?", optionBId, voteId),
        "UPDATE direto no voto deve ser rejeitado pelo trigger do banco");
  }
}
