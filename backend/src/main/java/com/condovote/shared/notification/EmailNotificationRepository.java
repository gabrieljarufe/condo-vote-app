package com.condovote.shared.notification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface EmailNotificationRepository extends CrudRepository<EmailNotification, UUID> {

  @Modifying
  @Query(
      """
          INSERT INTO email_notification
              (id, user_id, type, payload, status, attempts, scheduled_for, created_at)
          VALUES
              (:id, :userId, :type::email_type, :payload::jsonb,
               'PENDING'::email_status, 0, :scheduledFor, now())
          """)
  void insert(
      @Param("id") UUID id,
      @Param("userId") UUID userId,
      @Param("type") String type,
      @Param("payload") String payload,
      @Param("scheduledFor") Instant scheduledFor);

  @Query(
      """
          SELECT id, user_id, type, payload, status, attempts, last_error,
                 scheduled_for, sent_at, created_at
          FROM email_notification
          WHERE status = 'PENDING'::email_status AND scheduled_for <= :now
          ORDER BY scheduled_for, created_at
          LIMIT :limit
          """)
  List<EmailNotification> findPendingDueForSending(
      @Param("now") Instant now, @Param("limit") int limit);

  @Modifying
  @Query(
      """
          UPDATE email_notification
          SET status = 'SENT'::email_status, sent_at = :sentAt
          WHERE id = :id
          """)
  void markSent(@Param("id") UUID id, @Param("sentAt") Instant sentAt);

  @Modifying
  @Query(
      """
          UPDATE email_notification
          SET status = 'PENDING'::email_status,
              attempts = :attempts,
              last_error = :lastError,
              scheduled_for = :scheduledFor
          WHERE id = :id
          """)
  void markFailed(
      @Param("id") UUID id,
      @Param("attempts") int attempts,
      @Param("lastError") String error,
      @Param("scheduledFor") Instant nextRetryAt);

  @Modifying
  @Query(
      """
          UPDATE email_notification
          SET status = 'BOUNCED'::email_status,
              attempts = :attempts,
              last_error = :lastError
          WHERE id = :id
          """)
  void markBounced(
      @Param("id") UUID id, @Param("attempts") int attempts, @Param("lastError") String error);

  @Modifying
  @Query(
      """
          UPDATE email_notification
          SET status = 'FAILED'::email_status,
              attempts = :attempts,
              last_error = :lastError
          WHERE id = :id
          """)
  void markFailedFinal(
      @Param("id") UUID id, @Param("attempts") int attempts, @Param("lastError") String error);
}
