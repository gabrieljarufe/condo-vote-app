package com.condovote.poll;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface VoteRepository extends CrudRepository<Vote, UUID> {

  Optional<Vote> findByPollIdAndApartmentId(UUID pollId, UUID apartmentId);

  long countByPollId(UUID pollId);

  List<Vote> findByPollId(UUID pollId);

  /**
   * Retorna agregado (option_id, count) usado para calcular o resultado da poll. Cada elemento
   * representa uma opção que recebeu pelo menos um voto.
   */
  @Query(
      """
          SELECT poll_option_id AS option_id, COUNT(*) AS vote_count
          FROM vote
          WHERE poll_id = :pollId
          GROUP BY poll_option_id
          """)
  List<VoteTally> tallyByPollId(@Param("pollId") UUID pollId);

  /**
   * Projeção interna para tally — record é necessário pois Spring Data JDBC não suporta interface
   * projections em @Query customizado.
   */
  record VoteTally(UUID optionId, long voteCount) {}
}
