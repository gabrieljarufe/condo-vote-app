package com.condovote.condominium;

import com.condovote.auth.AuthGateway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class CondominiumService {

    // UNION (sem ALL) elimina duplicatas: usuário OWNER em dois aptos do mesmo condo
    // ainda produz apenas uma linha (condo_id, 'OWNER') — COUNT = 1 → role OWNER.
    // Roles distintas (ex: ADMIN + OWNER) produzem duas linhas → COUNT = 2 → MULTIPLE.
    private static final String QUERY = """
            WITH user_roles AS (
                SELECT condominium_id, 'ADMIN' AS role
                FROM condominium_admin
                WHERE user_id = ? AND revoked_at IS NULL
                UNION
                SELECT condominium_id, role::text
                FROM apartment_resident
                WHERE user_id = ? AND ended_at IS NULL
            ),
            grouped AS (
                SELECT condominium_id,
                       COUNT(*)   AS role_count,
                       MIN(role)  AS single_role
                FROM user_roles
                GROUP BY condominium_id
            )
            SELECT c.id, c.name,
                CASE WHEN g.role_count > 1 THEN 'MULTIPLE' ELSE g.single_role END AS role
            FROM grouped g
            JOIN condominium c ON c.id = g.condominium_id
            ORDER BY c.name
            """;

    private final JdbcTemplate jdbc;
    private final AuthGateway authGateway;

    public CondominiumService(JdbcTemplate jdbc, AuthGateway authGateway) {
        this.jdbc = jdbc;
        this.authGateway = authGateway;
    }

    public List<CondominiumSummary> listForCurrentUser() {
        UUID userId = authGateway.getCurrentUserId();
        return jdbc.query(QUERY,
                (rs, rowNum) -> new CondominiumSummary(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        UserRoleInCondo.valueOf(rs.getString("role"))),
                userId, userId);
    }
}
