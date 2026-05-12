package com.condovote.invitation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface InvitationRepository extends CrudRepository<Invitation, UUID> {

  @Modifying
  @Query(
      """
          INSERT INTO invitation
              (id, condominium_id, apartment_id, email, cpf_encrypted, role, status,
               expires_at, created_by_user_id, created_at)
          VALUES
              (:id, :condominiumId, :apartmentId, :email, :cpfEncrypted,
               :role::resident_role, 'PENDING'::invitation_status,
               :expiresAt, :createdByUserId, now())
          """)
  void insert(
      @Param("id") UUID id,
      @Param("condominiumId") UUID condominiumId,
      @Param("apartmentId") UUID apartmentId,
      @Param("email") String email,
      @Param("cpfEncrypted") byte[] cpfEncrypted,
      @Param("role") String role,
      @Param("expiresAt") Instant expiresAt,
      @Param("createdByUserId") UUID createdByUserId);

  @Query(
      """
          SELECT id, condominium_id, apartment_id, email, cpf_encrypted, role, status,
                 expires_at, accepted_at, revoked_at, revoked_by_user_id, created_by_user_id, created_at
          FROM invitation
          WHERE condominium_id = :condominiumId
          ORDER BY created_at DESC
          """)
  List<Invitation> findByCondominiumIdOrderByCreatedAtDesc(
      @Param("condominiumId") UUID condominiumId);

  @Query(
      """
          SELECT id, condominium_id, apartment_id, email, cpf_encrypted, role, status,
                 expires_at, accepted_at, revoked_at, revoked_by_user_id, created_by_user_id, created_at
          FROM invitation
          WHERE condominium_id = :condominiumId AND apartment_id = :apartmentId
          ORDER BY created_at DESC
          """)
  List<Invitation> findByCondominiumIdAndApartmentIdOrderByCreatedAtDesc(
      @Param("condominiumId") UUID condominiumId, @Param("apartmentId") UUID apartmentId);

  @Query(
      """
          SELECT id, condominium_id, apartment_id, email, cpf_encrypted, role, status,
                 expires_at, accepted_at, revoked_at, revoked_by_user_id, created_by_user_id, created_at
          FROM invitation
          WHERE condominium_id = :condominiumId AND status = :status::invitation_status
          ORDER BY created_at DESC
          """)
  List<Invitation> findByCondominiumIdAndStatus(
      @Param("condominiumId") UUID condominiumId, @Param("status") String status);

  @Modifying
  @Query(
      """
          UPDATE invitation
          SET status = 'REVOKED'::invitation_status,
              revoked_at = now(),
              revoked_by_user_id = :revokedByUserId
          WHERE id = :id AND status = 'PENDING'::invitation_status
          """)
  int revokePending(@Param("id") UUID id, @Param("revokedByUserId") UUID revokedByUserId);

  @Modifying
  @Query(
      """
          UPDATE invitation
          SET status = 'REVOKED'::invitation_status,
              revoked_at = now(),
              revoked_by_user_id = :revokedByUserId
          WHERE id = :id
          """)
  int revokeAny(@Param("id") UUID id, @Param("revokedByUserId") UUID revokedByUserId);

  @Modifying
  @Query(
      """
          UPDATE invitation
          SET status = 'BOUNCED'::invitation_status
          WHERE id = :id AND status = 'PENDING'::invitation_status
          """)
  int markBouncedIfPending(@Param("id") UUID id);

  @Modifying
  @Query(
      """
          UPDATE invitation
          SET status = 'EXPIRED'::invitation_status
          WHERE status = 'PENDING'::invitation_status
            AND expires_at < :now
          """)
  int markExpiredOlderThan(@Param("now") Instant now);
}
