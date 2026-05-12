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
import com.condovote.apartment.dto.CreateApartmentRequest;
import com.condovote.auth.AuthGateway;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.tenant.TenantMembershipRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ApartmentServiceTest {

  @Mock ApartmentRepository apartmentRepository;
  @Mock TenantMembershipRepository membershipRepository;
  @Mock AuthGateway authGateway;
  @Mock AuditEventPublisher auditEventPublisher;

  ApartmentService service;

  UUID userId = UuidV7.generate();
  UUID condoId = UuidV7.generate();

  @BeforeEach
  void setUp() {
    service =
        new ApartmentService(
            apartmentRepository, membershipRepository, authGateway, auditEventPublisher);
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
  void list_adminLista_retornaLista() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    Apartment apt =
        new Apartment(UuidV7.generate(), condoId, "A", "101", null, false, Instant.now());
    when(apartmentRepository.findByCondominiumIdOrdered(condoId)).thenReturn(List.of(apt));

    List<ApartmentResponse> result = service.listByCondominium(condoId);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).unitNumber()).isEqualTo("101");
  }

  @Test
  void list_naoAdmin_lancaForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);

    assertThatThrownBy(() -> service.listByCondominium(condoId))
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
}
