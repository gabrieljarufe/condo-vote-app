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
  void userWithNoCondos_returnsEmptyList() {
    UUID userId = UuidV7.generate();

    List<CondominiumSummary> result = repository.findSummariesForUser(userId);

    assertThat(result).isEmpty();
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
}
