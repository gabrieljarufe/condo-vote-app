package com.condovote.poll;

import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface PollEligibleSnapshotRepository extends CrudRepository<PollEligibleSnapshot, UUID> {

  /**
   * Insere snapshot de elegibilidade para todos os apartamentos não-inadimplentes do condomínio que
   * possuem eligible_voter_user_id definido. Executado na transição SCHEDULED→OPEN. Retorna o
   * número de linhas inseridas (= eligible_count a ser persistido no poll).
   */
  @Modifying
  @Query(
      """
          INSERT INTO poll_eligible_snapshot
              (id, poll_id, condominium_id, apartment_id, eligible_voter_user_id)
          SELECT gen_random_uuid(), :pollId, condominium_id, id, eligible_voter_user_id
          FROM apartment
          WHERE condominium_id = :condoId
            AND is_delinquent = false
            AND eligible_voter_user_id IS NOT NULL
          """)
  int insertSnapshotForCondominium(@Param("pollId") UUID pollId, @Param("condoId") UUID condoId);

  @Query("SELECT COUNT(*) FROM poll_eligible_snapshot WHERE poll_id = :pollId")
  long countByPollId(@Param("pollId") UUID pollId);
}
