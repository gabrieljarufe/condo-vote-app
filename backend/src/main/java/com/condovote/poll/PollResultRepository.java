package com.condovote.poll;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface PollResultRepository extends CrudRepository<PollResult, UUID> {

  @Query(
      """
          SELECT poll_id, condominium_id, quorum_denominator, total_votes_computed,
                 winning_option_id, quorum_reached,
                 invalidation_reason::text, close_trigger::text,
                 votes_per_option::text, computed_at
          FROM poll_result
          WHERE poll_id = :pollId
          """)
  Optional<PollResult> findByPollId(@Param("pollId") UUID pollId);
}
