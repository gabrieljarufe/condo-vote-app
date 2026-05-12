package com.condovote.apartment;

import com.condovote.apartment.dto.ApartmentResponse;
import com.condovote.apartment.dto.BatchCreateApartmentResponse;
import com.condovote.apartment.dto.CreateApartmentRequest;
import com.condovote.auth.AuthGateway;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.tenant.TenantMembershipRepository;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApartmentService {

  private final ApartmentRepository apartmentRepository;
  private final TenantMembershipRepository membershipRepository;
  private final AuthGateway authGateway;
  private final AuditEventPublisher auditEventPublisher;
  private final NamedParameterJdbcTemplate namedJdbc;

  public ApartmentService(
      ApartmentRepository apartmentRepository,
      TenantMembershipRepository membershipRepository,
      AuthGateway authGateway,
      AuditEventPublisher auditEventPublisher,
      NamedParameterJdbcTemplate namedJdbc) {
    this.apartmentRepository = apartmentRepository;
    this.membershipRepository = membershipRepository;
    this.authGateway = authGateway;
    this.auditEventPublisher = auditEventPublisher;
    this.namedJdbc = namedJdbc;
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
  public BatchCreateApartmentResponse createBatch(
      UUID condominiumId, List<CreateApartmentRequest> items) {
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, condominiumId)) {
      throw new ForbiddenException("Apenas síndicos podem cadastrar apartamentos");
    }

    StringBuilder sql =
        new StringBuilder(
            "INSERT INTO apartment (id, condominium_id, block, unit_number, is_delinquent, created_at) VALUES ");
    MapSqlParameterSource params = new MapSqlParameterSource();
    params.addValue("condoId", condominiumId);
    for (int i = 0; i < items.size(); i++) {
      if (i > 0) sql.append(", ");
      sql.append("(:id")
          .append(i)
          .append(", :condoId, :block")
          .append(i)
          .append(", :unit")
          .append(i)
          .append(", false, now())");
      params.addValue("id" + i, UuidV7.generate());
      params.addValue("block" + i, items.get(i).block());
      params.addValue("unit" + i, items.get(i).unitNumber());
    }
    sql.append(
        " ON CONFLICT (condominium_id, (COALESCE(block, '')), unit_number) DO NOTHING"
            + " RETURNING id, condominium_id, block, unit_number, eligible_voter_user_id, is_delinquent, created_at");

    List<ApartmentResponse> created =
        namedJdbc.query(
            sql.toString(),
            params,
            (rs, rowNum) ->
                new ApartmentResponse(
                    (UUID) rs.getObject("id"),
                    (UUID) rs.getObject("condominium_id"),
                    rs.getString("unit_number"),
                    rs.getString("block"),
                    rs.getBoolean("is_delinquent"),
                    (UUID) rs.getObject("eligible_voter_user_id"),
                    rs.getObject("created_at", Timestamp.class) != null
                        ? rs.getObject("created_at", Timestamp.class).toInstant()
                        : null));

    Set<String> createdKeys =
        created.stream()
            .map(r -> apartmentKey(r.block(), r.unitNumber()))
            .collect(Collectors.toSet());

    List<BatchCreateApartmentResponse.SkippedItem> skipped =
        items.stream()
            .filter(item -> !createdKeys.contains(apartmentKey(item.block(), item.unitNumber())))
            .map(
                item ->
                    new BatchCreateApartmentResponse.SkippedItem(
                        item.unitNumber(),
                        item.block(),
                        BatchCreateApartmentResponse.SkipReason.DUPLICATE))
            .toList();

    if (!created.isEmpty()) {
      auditEventPublisher.publish(
          "APARTMENT_BATCH_CREATED",
          "apartment",
          condominiumId,
          Map.of("count", created.size()),
          condominiumId,
          userId);
    }

    return new BatchCreateApartmentResponse(created, skipped);
  }

  private static String apartmentKey(String block, String unit) {
    return (block == null ? "" : block) + "||" + unit;
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
