package com.condovote.shared.tenant;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TenantMembershipRepository {

  private final JdbcTemplate jdbcTemplate;

  public TenantMembershipRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public boolean userBelongsToTenant(UUID userId, UUID tenantId) {
    Boolean result =
        jdbcTemplate.queryForObject(
            """
                SELECT EXISTS (
                    SELECT 1 FROM condominium_admin
                    WHERE user_id = ? AND condominium_id = ? AND revoked_at IS NULL
                ) OR EXISTS (
                    SELECT 1 FROM apartment_resident
                    WHERE user_id = ? AND condominium_id = ? AND ended_at IS NULL
                )
                """,
            Boolean.class,
            userId,
            tenantId,
            userId,
            tenantId);
    return Boolean.TRUE.equals(result);
  }
}
