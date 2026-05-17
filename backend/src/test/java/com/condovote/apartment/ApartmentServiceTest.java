package com.condovote.apartment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.apartment.dto.ApartmentResponse;
import com.condovote.apartment.dto.BatchCreateApartmentResponse;
import com.condovote.apartment.dto.CreateApartmentRequest;
import com.condovote.auth.AuthGateway;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.tenant.TenantMembershipRepository;
import com.condovote.shared.web.PageResponse;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

@ExtendWith(MockitoExtension.class)
class ApartmentServiceTest {

  @Mock ApartmentRepository apartmentRepository;
  @Mock TenantMembershipRepository membershipRepository;
  @Mock AuthGateway authGateway;
  @Mock AuditEventPublisher auditEventPublisher;
  @Mock NamedParameterJdbcTemplate namedJdbc;

  ApartmentService service;

  UUID userId = UuidV7.generate();
  UUID condoId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    service =
        new ApartmentService(
            apartmentRepository, membershipRepository, authGateway, auditEventPublisher, namedJdbc);
    lenient().when(authGateway.getCurrentUserId()).thenReturn(userId);
  }

  @Test
  void create_adminCria_retornaApartamento() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    UUID aptId = UuidV7.generate();
    Apartment apt = new Apartment(aptId, condoId, "A", "101", null, false, Instant.now());
    when(apartmentRepository.findById(any())).thenReturn(Optional.of(apt));

    ApartmentResponse result = service.create(condoId, new CreateApartmentRequest("101", "A"));

    verify(apartmentRepository).insert(any(), eq(condoId), eq("101"), eq("A"));
    verify(auditEventPublisher)
        .publish(eq("APARTMENT_CREATED"), eq("apartment"), any(), any(), eq(condoId), eq(userId));
    assertThat(result.unitNumber()).isEqualTo("101");
    assertThat(result.isDelinquent()).isFalse();
  }

  @Test
  void create_naoAdmin_lancaForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(() -> service.create(condoId, new CreateApartmentRequest("101", "A")))
        .isInstanceOf(ForbiddenException.class);
    verify(apartmentRepository, never()).insert(any(), any(), anyString(), anyString());
  }

  @Test
  void list_adminLista_defaultPage_retornaPaginaPrimeira() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    Apartment apt =
        new Apartment(UuidV7.generate(), condoId, "A", "101", null, false, Instant.now());
    when(apartmentRepository.findByCondominiumIdOrderedPaged(condoId, 20, 0))
        .thenReturn(List.of(apt));
    when(apartmentRepository.countByCondominiumId(condoId)).thenReturn(1L);

    PageResponse<ApartmentResponse> result = service.listByCondominium(condoId, 0, 20);

    assertThat(result.content()).hasSize(1);
    assertThat(result.content().get(0).unitNumber()).isEqualTo("101");
    assertThat(result.page()).isZero();
    assertThat(result.size()).isEqualTo(20);
    assertThat(result.totalElements()).isEqualTo(1L);
    assertThat(result.totalPages()).isEqualTo(1);
  }

  @Test
  void list_paginaSeguinte_calculaOffsetCorretamente() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    Apartment apt =
        new Apartment(UuidV7.generate(), condoId, "A", "201", null, false, Instant.now());
    when(apartmentRepository.findByCondominiumIdOrderedPaged(condoId, 10, 20))
        .thenReturn(List.of(apt));
    when(apartmentRepository.countByCondominiumId(condoId)).thenReturn(25L);

    PageResponse<ApartmentResponse> result = service.listByCondominium(condoId, 2, 10);

    assertThat(result.content()).hasSize(1);
    assertThat(result.page()).isEqualTo(2);
    assertThat(result.size()).isEqualTo(10);
    assertThat(result.totalElements()).isEqualTo(25L);
    assertThat(result.totalPages()).isEqualTo(3);
  }

  @Test
  void list_paginaVazia_retornaContentVazio() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(apartmentRepository.findByCondominiumIdOrderedPaged(condoId, 20, 100))
        .thenReturn(List.of());
    when(apartmentRepository.countByCondominiumId(condoId)).thenReturn(3L);

    PageResponse<ApartmentResponse> result = service.listByCondominium(condoId, 5, 20);

    assertThat(result.content()).isEmpty();
    assertThat(result.totalElements()).isEqualTo(3L);
  }

  @Test
  void list_pageNegativa_lancaIllegalArgument() {
    assertThatThrownBy(() -> service.listByCondominium(condoId, -1, 20))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void list_sizeForaDoIntervalo_lancaIllegalArgument() {
    assertThatThrownBy(() -> service.listByCondominium(condoId, 0, 0))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.listByCondominium(condoId, 0, 101))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void list_naoAdmin_lancaForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);
    when(apartmentRepository.findActiveResidencyApartments(condoId, userId)).thenReturn(List.of());

    assertThatThrownBy(() -> service.listByCondominium(condoId, 0, 20))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void list_moradorComUmApto_retornaListaSemPaginacao() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);
    Apartment apt =
        new Apartment(UuidV7.generate(), condoId, "A", "101", null, false, Instant.now());
    when(apartmentRepository.findActiveResidencyApartments(condoId, userId))
        .thenReturn(List.of(apt));

    PageResponse<ApartmentResponse> result = service.listByCondominium(condoId, 0, 20);

    assertThat(result.content()).hasSize(1);
    assertThat(result.content().get(0).unitNumber()).isEqualTo("101");
    assertThat(result.page()).isZero();
    assertThat(result.size()).isEqualTo(1);
    assertThat(result.totalElements()).isEqualTo(1L);
    assertThat(result.totalPages()).isEqualTo(1);
  }

  @Test
  void list_moradorComDoisAptos_retornaAmbos() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);
    Apartment apt1 =
        new Apartment(UuidV7.generate(), condoId, "A", "101", null, false, Instant.now());
    Apartment apt2 =
        new Apartment(UuidV7.generate(), condoId, "A", "102", null, false, Instant.now());
    when(apartmentRepository.findActiveResidencyApartments(condoId, userId))
        .thenReturn(List.of(apt1, apt2));

    PageResponse<ApartmentResponse> result = service.listByCondominium(condoId, 0, 20);

    assertThat(result.content()).hasSize(2);
    assertThat(result.totalElements()).isEqualTo(2L);
    assertThat(result.size()).isEqualTo(2);
  }

  @Test
  void list_moradorSemVinculo_lancaForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);
    when(apartmentRepository.findActiveResidencyApartments(condoId, userId)).thenReturn(List.of());

    assertThatThrownBy(() -> service.listByCondominium(condoId, 0, 20))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void setDelinquent_toggle_atualiza() {
    UUID aptId = UuidV7.generate();
    Apartment apt = new Apartment(aptId, condoId, "A", "101", null, false, Instant.now());
    Apartment updated = new Apartment(aptId, condoId, "A", "101", null, true, Instant.now());
    when(apartmentRepository.findById(aptId))
        .thenReturn(Optional.of(apt))
        .thenReturn(Optional.of(updated));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    ApartmentResponse result = service.setDelinquent(aptId, true);

    verify(apartmentRepository).updateDelinquent(aptId, true);
    verify(auditEventPublisher)
        .publish(
            eq("APARTMENT_DELINQUENCY_CHANGED"),
            eq("apartment"),
            eq(aptId),
            any(),
            eq(condoId),
            eq(userId));
    assertThat(result.isDelinquent()).isTrue();
  }

  @Test
  void setDelinquent_idempotente_naoAtualizaSeEstadoIgual() {
    UUID aptId = UuidV7.generate();
    Apartment apt = new Apartment(aptId, condoId, "A", "101", null, true, Instant.now());
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(apt));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    ApartmentResponse result = service.setDelinquent(aptId, true);

    verify(apartmentRepository, never()).updateDelinquent(any(), anyBoolean());
    verify(auditEventPublisher, never()).publish(anyString(), anyString(), any(), any());
    assertThat(result.isDelinquent()).isTrue();
  }

  @Test
  void setDelinquent_apartamentoNaoEncontrado_lancaNotFound() {
    UUID aptId = UuidV7.generate();
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.setDelinquent(aptId, true))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void setDelinquent_naoAdmin_lancaForbidden() {
    UUID aptId = UuidV7.generate();
    Apartment apt = new Apartment(aptId, condoId, "A", "101", null, false, Instant.now());
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(apt));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(() -> service.setDelinquent(aptId, true))
        .isInstanceOf(ForbiddenException.class);
    verify(apartmentRepository, never()).updateDelinquent(any(), anyBoolean());
  }

  // --- createBatch ---

  @Test
  @SuppressWarnings("unchecked")
  void createBatch_adminCriaTodos_retornaTodosCreated() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    ApartmentResponse apt1 =
        new ApartmentResponse(UuidV7.generate(), condoId, "101", "A", false, null, Instant.now());
    ApartmentResponse apt2 =
        new ApartmentResponse(UuidV7.generate(), condoId, "102", "A", false, null, Instant.now());
    when(namedJdbc.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
        .thenReturn(List.of(apt1, apt2));

    List<CreateApartmentRequest> items =
        List.of(new CreateApartmentRequest("101", "A"), new CreateApartmentRequest("102", "A"));
    BatchCreateApartmentResponse result = service.createBatch(condoId, items);

    assertThat(result.created()).hasSize(2);
    assertThat(result.skipped()).isEmpty();
    verify(auditEventPublisher)
        .publish(
            eq("APARTMENT_BATCH_CREATED"), eq("apartment"), any(), any(), eq(condoId), eq(userId));
  }

  @Test
  @SuppressWarnings("unchecked")
  void createBatch_comDuplicatas_retornaSkipped() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    // apenas apt1 retornado (apt2 é duplicata)
    ApartmentResponse apt1 =
        new ApartmentResponse(UuidV7.generate(), condoId, "101", "A", false, null, Instant.now());
    when(namedJdbc.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
        .thenReturn(List.of(apt1));

    List<CreateApartmentRequest> items =
        List.of(new CreateApartmentRequest("101", "A"), new CreateApartmentRequest("102", "A"));
    BatchCreateApartmentResponse result = service.createBatch(condoId, items);

    assertThat(result.created()).hasSize(1);
    assertThat(result.skipped()).hasSize(1);
    assertThat(result.skipped().get(0).unitNumber()).isEqualTo("102");
    assertThat(result.skipped().get(0).reason())
        .isEqualTo(BatchCreateApartmentResponse.SkipReason.DUPLICATE);
  }

  @Test
  void createBatch_naoAdmin_lancaForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(
            () -> service.createBatch(condoId, List.of(new CreateApartmentRequest("101", "A"))))
        .isInstanceOf(ForbiddenException.class);
    verify(namedJdbc, never())
        .query(anyString(), any(SqlParameterSource.class), any(RowMapper.class));
  }
}
