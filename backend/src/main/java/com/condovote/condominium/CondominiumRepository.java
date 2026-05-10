package com.condovote.condominium;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

public interface CondominiumRepository extends CrudRepository<Condominium, UUID> {

  @Query(
      """
            WITH user_roles AS (
                SELECT condominium_id, 'ADMIN' AS role
                FROM condominium_admin
                WHERE user_id = :userId AND revoked_at IS NULL
                UNION
                SELECT condominium_id, role::text
                FROM apartment_resident
                WHERE user_id = :userId AND ended_at IS NULL
            )
            SELECT c.id, c.name,
                   array_agg(DISTINCT ur.role ORDER BY ur.role) AS roles
            FROM user_roles ur
            JOIN condominium c ON c.id = ur.condominium_id
            GROUP BY c.id, c.name
            ORDER BY c.name
            """)
  List<CondominiumSummary> findSummariesForUser(@Param("userId") UUID userId);
}
