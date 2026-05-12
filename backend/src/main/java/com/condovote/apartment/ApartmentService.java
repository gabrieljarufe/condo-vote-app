package com.condovote.apartment;

import com.condovote.apartment.dto.ApartmentResponse;
import com.condovote.apartment.dto.CreateApartmentRequest;
import com.condovote.auth.AuthGateway;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.tenant.TenantMembershipRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApartmentService {

  private final ApartmentRepository apartmentRepository;
  private final TenantMembershipRepository membershipRepository;
  private final AuthGateway authGateway;
  private final AuditEventPublisher auditEventPublisher;

  public ApartmentService(
      ApartmentRepository apartmentRepository,
      TenantMembershipRepository membershipRepository,
      AuthGateway authGateway,
      AuditEventPublisher auditEventPublisher) {
    this.apartmentRepository = apartmentRepository;
    this.membershipRepository = membershipRepository;
    this.authGateway = authGateway;
    this.auditEventPublisher = auditEventPublisher;
  }

  @Transactional
  public ApartmentResponse create(UUID condominiumId, CreateApartmentRequest request) {
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, condominiumId)) {
      throw new ForbiddenException("Apenas síndicos podem cadastrar apartamentos");
    }
    UUID id = UuidV7.generate();
    apartmentRepository.insert(id, condominiumId, request.unitNumber(), request.block());
    Apartment saved =
        apartmentRepository
            .findById(id)
            .orElseThrow(
                () -> new IllegalStateException("Apartamento recém-inserido não encontrado"));
    auditEventPublisher.publish(
        "APARTMENT_CREATED",
        "apartment",
        id,
        Map.of("unitNumber", request.unitNumber(), "block", String.valueOf(request.block())),
        condominiumId,
        userId);
    return ApartmentResponse.from(saved);
  }

  @Transactional(readOnly = true)
  public List<ApartmentResponse> listByCondominium(UUID condominiumId) {
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, condominiumId)) {
      throw new ForbiddenException("Apenas síndicos podem listar apartamentos");
    }
    return apartmentRepository.findByCondominiumIdOrdered(condominiumId).stream()
        .map(ApartmentResponse::from)
        .toList();
  }

  @Transactional
  public ApartmentResponse setDelinquent(UUID id, boolean isDelinquent) {
    Apartment apartment =
        apartmentRepository
            .findById(id)
            .orElseThrow(() -> new NotFoundException("Apartamento não encontrado"));
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, apartment.condominiumId())) {
      throw new ForbiddenException("Apenas síndicos podem alterar inadimplência");
    }
    boolean previous = apartment.isDelinquent();
    if (previous == isDelinquent) {
      return ApartmentResponse.from(apartment);
    }
    apartmentRepository.updateDelinquent(id, isDelinquent);
    auditEventPublisher.publish(
        "APARTMENT_DELINQUENCY_CHANGED",
        "apartment",
        id,
        Map.of("from", previous, "to", isDelinquent),
        apartment.condominiumId(),
        userId);
    Apartment updated =
        apartmentRepository
            .findById(id)
            .orElseThrow(() -> new IllegalStateException("Apartamento não encontrado após update"));
    return ApartmentResponse.from(updated);
  }
}
