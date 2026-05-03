package com.condovote.condominium;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CondominiumRepository extends CrudRepository<Condominium, UUID> {

    // UNION (sem ALL) elimina duplicatas: usuário OWNER em dois aptos do mesmo condo
    // ainda produz apenas uma linha (condo_id, 'OWNER') — COUNT = 1 → role OWNER.
    // Roles distintas (ex: ADMIN + OWNER) produzem duas linhas → COUNT = 2 → MULTIPLE.
    @Query("""
            WITH user_roles AS (
                SELECT condominium_id, 'ADMIN' AS role
                FROM condominium_admin
                WHERE user_id = :userId AND revoked_at IS NULL
                UNION
                SELECT condominium_id, role::text
                FROM apartment_resident
                WHERE user_id = :userId AND ended_at IS NULL
            ),
            grouped AS (
                SELECT condominium_id,
                       COUNT(*)  AS role_count,
                       MIN(role) AS single_role
                FROM user_roles
                GROUP BY condominium_id
            )
            SELECT c.id, c.name,
                CASE WHEN g.role_count > 1 THEN 'MULTIPLE' ELSE g.single_role END AS role
            FROM grouped g
            JOIN condominium c ON c.id = g.condominium_id
            ORDER BY c.name
            """)
    List<CondominiumSummary> findSummariesForUser(@Param("userId") UUID userId);
}
