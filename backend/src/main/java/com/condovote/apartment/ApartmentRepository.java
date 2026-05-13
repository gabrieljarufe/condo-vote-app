package com.condovote.apartment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface ApartmentRepository extends CrudRepository<Apartment, UUID> {

  @Modifying
  @Query(
      """
          INSERT INTO apartment (id, condominium_id, unit_number, block, is_delinquent, created_at)
          VALUES (:id, :condominiumId, :unitNumber, :block, false, now())
          """)
  void insert(
      @Param("id") UUID id,
      @Param("condominiumId") UUID condominiumId,
      @Param("unitNumber") String unitNumber,
      @Param("block") String block);

  @Query(
      """
          SELECT id, condominium_id, block, unit_number, eligible_voter_user_id, is_delinquent, created_at
          FROM apartment
          WHERE condominium_id = :condominiumId
          ORDER BY COALESCE(block, '') ASC, LENGTH(unit_number) ASC, unit_number ASC
          """)
  List<Apartment> findByCondominiumIdOrdered(@Param("condominiumId") UUID condominiumId);

  @Modifying
  @Query("UPDATE apartment SET is_delinquent = :isDelinquent WHERE id = :id")
  void updateDelinquent(@Param("id") UUID id, @Param("isDelinquent") boolean isDelinquent);

  @Query(
      """
          SELECT id
          FROM apartment
          WHERE condominium_id = :condominiumId
            AND COALESCE(block, '') = COALESCE(:block, '')
            AND unit_number = :unitNumber
          """)
  Optional<UUID> findIdByCondoBlockUnit(
      @Param("condominiumId") UUID condominiumId,
      @Param("block") String block,
      @Param("unitNumber") String unitNumber);
}
