package com.condovote.condominium;

import static org.assertj.core.api.Assertions.assertThat;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Testa a query do CondominiumRepository diretamente contra banco real.
 *
 * <p>Verifica que array_agg + StringArrayToUserRoleSetConverter produzem corretamente um
 * Set<UserRoleInCondo> para cada combinação de papéis do usuário num condomínio.
 */
@Tag("integration")
@SpringBootTest
@Transactional
class CondominiumRepositoryTest extends AbstractIntegrationTest {

  @Autowired CondominiumRepository repository;

  @Autowired JdbcTemplate jdbc;

  @Test
  void userIsAdmin_returnsAdminRoleSet() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Admin");
    insertAdmin(condoId, userId);

    List<CondominiumSummary> result = repository.findSummariesForUser(userId);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo(condoId);
    assertThat(result.get(0).roles()).isEqualTo(Set.of(UserRoleInCondo.ADMIN));
  }

  @Test
  void userIsOwner_returnsOwnerRoleSet() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Owner");
    UUID aptId = insertApartment(condoId, "101");
    insertResident(condoId, aptId, userId, "OWNER");

    List<CondominiumSummary> result = repository.findSummariesForUser(userId);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo(condoId);
    assertThat(result.get(0).roles()).isEqualTo(Set.of(UserRoleInCondo.OWNER));
  }

  @Test
  void userIsAdminAndOwnerSameCondo_returnsBothRoles() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Admin+Owner");
    UUID aptId = insertApartment(condoId, "201");
    insertAdmin(condoId, userId);
    insertResident(condoId, aptId, userId, "OWNER");

    List<CondominiumSummary> result = repository.findSummariesForUser(userId);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo(condoId);
    assertThat(result.get(0).roles())
        .isEqualTo(Set.of(UserRoleInCondo.ADMIN, UserRoleInCondo.OWNER));
  }

  @Test
  void userInTwoCondos_returnsSeparateRoleSets() {
    UUID userId = UuidV7.generate();
    UUID condoAdmin = insertCondo("Condo A Admin");
    UUID condoResident = insertCondo("Condo B Tenant");
    UUID aptId = insertApartment(condoResident, "301");
    insertAdmin(condoAdmin, userId);
    insertResident(condoResident, aptId, userId, "TENANT");

    List<CondominiumSummary> result = repository.findSummariesForUser(userId);

    assertThat(result).hasSize(2);
    // Results are ordered by name: "Condo A Admin" < "Condo B Tenant"
    CondominiumSummary first =
        result.stream().filter(s -> s.id().equals(condoAdmin)).findFirst().orElseThrow();
    CondominiumSummary second =
        result.stream().filter(s -> s.id().equals(condoResident)).findFirst().orElseThrow();

    assertThat(first.roles()).isEqualTo(Set.of(UserRoleInCondo.ADMIN));
    assertThat(second.roles()).isEqualTo(Set.of(UserRoleInCondo.TENANT));
  }

  // --- fixtures ---

  private UUID insertCondo(String name) {
    UUID id = UuidV7.generate();
    jdbc.update(
        "INSERT INTO condominium (id, name, address, created_at) VALUES (?, ?, 'Rua Test, 1', now())",
        id,
        name);
    return id;
  }

  private UUID insertApartment(UUID condoId, String unit) {
    UUID id = UuidV7.generate();
    jdbc.update(
        "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at) VALUES (?, ?, ?, false, now())",
        id,
        condoId,
        unit);
    return id;
  }

  private void insertAdmin(UUID condoId, UUID userId) {
    jdbc.update(
        "INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (?, ?, ?, now())",
        UuidV7.generate(),
        condoId,
        userId);
  }

  private void insertResident(UUID condoId, UUID aptId, UUID userId, String role) {
    jdbc.update(
        "INSERT INTO apartment_resident (id, condominium_id, apartment_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?::resident_role, now())",
        UuidV7.generate(),
        condoId,
        aptId,
        userId,
        role);
  }
}
