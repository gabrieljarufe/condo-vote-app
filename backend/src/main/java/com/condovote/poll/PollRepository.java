package com.condovote.poll;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface PollRepository extends CrudRepository<Poll, UUID> {

  @Query(
      """
          SELECT id, condominium_id, title, description, convocation::text, quorum_mode::text,
                 status::text, scheduled_start, scheduled_end, opened_at, opened_by_user_id,
                 eligible_count, closed_at, cancelled_at, cancellation_reason,
                 cancelled_by_user_id, previous_poll_id, created_by_user_id, created_at,
                 updated_at
          FROM poll
          WHERE condominium_id = :condoId
            AND (:statusFilterDisabled OR status::text IN (:statuses))
          ORDER BY created_at DESC
          LIMIT :limit OFFSET :offset
          """)
  List<Poll> findByCondominiumIdFilteredPaged(
      @Param("condoId") UUID condoId,
      @Param("statusFilterDisabled") boolean statusFilterDisabled,
      @Param("statuses") List<String> statuses,
      @Param("limit") int limit,
      @Param("offset") int offset);

  @Query(
      """
          SELECT COUNT(*)
          FROM poll
          WHERE condominium_id = :condoId
            AND (:statusFilterDisabled OR status::text IN (:statuses))
          """)
  long countByCondominiumIdFiltered(
      @Param("condoId") UUID condoId,
      @Param("statusFilterDisabled") boolean statusFilterDisabled,
      @Param("statuses") List<String> statuses);

  @Query(
      """
          SELECT COUNT(*) > 0
          FROM poll
          WHERE condominium_id = :condominiumId
            AND status::text = :status
          """)
  boolean existsByCondominiumIdAndStatus(
      @Param("condominiumId") UUID condominiumId, @Param("status") String status);
}
