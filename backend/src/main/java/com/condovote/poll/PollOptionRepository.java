package com.condovote.poll;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface PollOptionRepository extends CrudRepository<PollOption, UUID> {

  @Query(
      """
          SELECT id, poll_id, label, display_order
          FROM poll_option
          WHERE poll_id = :pollId
          ORDER BY display_order ASC
          """)
  List<PollOption> findByPollIdOrderByDisplayOrder(@Param("pollId") UUID pollId);

  @Modifying
  @Query("DELETE FROM poll_option WHERE poll_id = :pollId")
  void deleteByPollId(@Param("pollId") UUID pollId);
}
