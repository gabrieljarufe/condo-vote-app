package com.condovote.condominium;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.condovote.AbstractIntegrationTest;
import com.condovote.auth.AuthGateway;
import com.condovote.shared.UuidV7;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

/**
 * Testa a query cross-tenant de CondominiumService contra banco real.
 *
 * <p>RLS está habilitada nas tabelas, mas a role postgres é table owner e não tem FORCE ROW LEVEL
 * SECURITY — bypassa RLS automaticamente, exatamente como no Supabase Cloud. Sem necessidade de SET
 * ROLE. @Transactional garante rollback automático entre testes.
 */
@Tag("integration")
@SpringBootTest
@Transactional
class CondominiumServiceIT extends AbstractIntegrationTest {

  @Autowired CondominiumService service;

  @Autowired JdbcTemplate jdbc;

  @MockitoBean AuthGateway authGateway;

  @Test
  void userIsAdmin_returnsAdminRole() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Alpha");
    insertAdmin(condoId, userId);
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo(condoId);
    assertThat(result.get(0).name()).isEqualTo("Condo Alpha");
    assertThat(result.get(0).role()).isEqualTo(UserRoleInCondo.ADMIN);
  }

  @Test
  void userIsOwner_returnsOwnerRole() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Beta");
    UUID aptId = insertApartment(condoId, "101");
    insertResident(condoId, aptId, userId, "OWNER");
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).role()).isEqualTo(UserRoleInCondo.OWNER);
  }

  @Test
  void userIsTenant_returnsTenantRole() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Gamma");
    UUID aptId = insertApartment(condoId, "202");
    insertResident(condoId, aptId, userId, "TENANT");
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).role()).isEqualTo(UserRoleInCondo.TENANT);
  }

  @Test
  void userIsAdminAndResident_returnsMultipleRole() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Delta");
    UUID aptId = insertApartment(condoId, "303");
    insertAdmin(condoId, userId);
    insertResident(condoId, aptId, userId, "OWNER");
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).role()).isEqualTo(UserRoleInCondo.MULTIPLE);
  }

  @Test
  void userIsOwnerAndTenantInSameCondo_returnsMultipleRole() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Epsilon");
    UUID apt1 = insertApartment(condoId, "101");
    UUID apt2 = insertApartment(condoId, "102");
    insertResident(condoId, apt1, userId, "OWNER");
    insertResident(condoId, apt2, userId, "TENANT");
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).role()).isEqualTo(UserRoleInCondo.MULTIPLE);
  }

  @Test
  void userHasNoCondominiums_returnsEmptyList() {
    when(authGateway.getCurrentUserId()).thenReturn(UuidV7.generate());

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).isEmpty();
  }

  @Test
  void revokedAdminIsExcluded() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Revogado");
    insertRevokedAdmin(condoId, userId);
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).isEmpty();
  }

  @Test
  void endedResidentIsExcluded() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Encerrado");
    UUID aptId = insertApartment(condoId, "404");
    insertEndedResident(condoId, aptId, userId, "OWNER");
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).isEmpty();
  }

  @Test
  void multipleCondos_resultOrderedByName() {
    UUID userId = UuidV7.generate();
    UUID condoZ = insertCondo("Zeta Condo");
    UUID condoA = insertCondo("Alfa Condo");
    insertAdmin(condoZ, userId);
    insertAdmin(condoA, userId);
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    assertThat(result).hasSize(2);
    assertThat(result.get(0).name()).isEqualTo("Alfa Condo");
    assertThat(result.get(1).name()).isEqualTo("Zeta Condo");
  }

  @Test
  void ownerInTwoApartmentsSameCondo_returnsOwnerNotMultiple() {
    UUID userId = UuidV7.generate();
    UUID condoId = insertCondo("Condo Dois Aptos");
    UUID apt1 = insertApartment(condoId, "501");
    UUID apt2 = insertApartment(condoId, "502");
    insertResident(condoId, apt1, userId, "OWNER");
    insertResident(condoId, apt2, userId, "OWNER");
    when(authGateway.getCurrentUserId()).thenReturn(userId);

    List<CondominiumSummary> result = service.listForCurrentUser();

    // UNION elimina duplicatas — mesmo role em dois aptos = única linha OWNER, não MULTIPLE
    assertThat(result).hasSize(1);
    assertThat(result.get(0).role()).isEqualTo(UserRoleInCondo.OWNER);
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

  private void insertRevokedAdmin(UUID condoId, UUID userId) {
    jdbc.update(
        "INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at, revoked_at, revoked_by_user_id) VALUES (?, ?, ?, now(), now(), ?)",
        UuidV7.generate(),
        condoId,
        userId,
        UuidV7.generate());
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

  private void insertEndedResident(UUID condoId, UUID aptId, UUID userId, String role) {
    jdbc.update(
        "INSERT INTO apartment_resident (id, condominium_id, apartment_id, user_id, role, joined_at, ended_at, ended_by_user_id, end_reason) VALUES (?, ?, ?, ?, ?::resident_role, now(), now(), ?, 'REMOVED_BY_ADMIN'::resident_end_reason)",
        UuidV7.generate(),
        condoId,
        aptId,
        userId,
        role,
        UuidV7.generate());
  }
}
