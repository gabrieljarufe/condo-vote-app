package com.condovote.invitation;

import com.condovote.apartment.ApartmentRepository;
import com.condovote.auth.AuthGateway;
import com.condovote.invitation.dto.BulkCreateInvitationRequest;
import com.condovote.invitation.dto.BulkResultResponse;
import com.condovote.invitation.dto.BulkResultResponse.BulkRowError;
import com.condovote.invitation.dto.CreateInvitationRequest;
import com.condovote.invitation.dto.FixEmailRequest;
import com.condovote.invitation.dto.InvitationResponse;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.crypto.CpfEncryptor;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.ForbiddenException;
import com.condovote.shared.exception.NotFoundException;
import com.condovote.shared.notification.EmailNotificationRepository;
import com.condovote.shared.tenant.TenantContext;
import com.condovote.shared.tenant.TenantMembershipRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvitationService {

  private final InvitationRepository invitationRepository;
  private final EmailNotificationRepository emailNotificationRepository;
  private final ApartmentRepository apartmentRepository;
  private final CpfEncryptor cpfEncryptor;
  private final AuditEventPublisher auditEventPublisher;
  private final TenantMembershipRepository membershipRepository;
  private final AuthGateway authGateway;
  private final RedisCommands<String, String> redisCommands;
  private final ObjectMapper objectMapper;
  private final int tokenTtlHours;
  private final String acceptBaseUrl;

  public InvitationService(
      InvitationRepository invitationRepository,
      EmailNotificationRepository emailNotificationRepository,
      ApartmentRepository apartmentRepository,
      CpfEncryptor cpfEncryptor,
      AuditEventPublisher auditEventPublisher,
      TenantMembershipRepository membershipRepository,
      AuthGateway authGateway,
      RedisCommands<String, String> redisCommands,
      ObjectMapper objectMapper,
      @Value("${app.invitation.token-ttl-hours:24}") int tokenTtlHours,
      @Value("${app.email.accept-base-url}") String acceptBaseUrl) {
    this.invitationRepository = invitationRepository;
    this.emailNotificationRepository = emailNotificationRepository;
    this.apartmentRepository = apartmentRepository;
    this.cpfEncryptor = cpfEncryptor;
    this.auditEventPublisher = auditEventPublisher;
    this.membershipRepository = membershipRepository;
    this.authGateway = authGateway;
    this.redisCommands = redisCommands;
    this.objectMapper = objectMapper;
    this.tokenTtlHours = tokenTtlHours;
    this.acceptBaseUrl = acceptBaseUrl;
  }

  @Transactional
  public InvitationResponse create(UUID condominiumId, CreateInvitationRequest req) {
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, condominiumId)) {
      throw new ForbiddenException("Apenas síndicos podem criar convites");
    }

    var apt =
        apartmentRepository
            .findById(req.apartmentId())
            .orElseThrow(() -> new NotFoundException("Apartamento não encontrado"));
    if (!apt.condominiumId().equals(condominiumId)) {
      throw new NotFoundException("Apartamento não encontrado");
    }

    return createOneInternal(
        condominiumId, req.apartmentId(), req.email(), req.cpf(), req.role(), userId);
  }

  @Transactional
  public BulkResultResponse createBulk(UUID condominiumId, BulkCreateInvitationRequest req) {
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, condominiumId)) {
      throw new ForbiddenException("Apenas síndicos podem criar convites");
    }

    if (req.entries().size() > 200) {
      throw new IllegalArgumentException("máximo 200 convites por upload");
    }

    List<BulkRowError> errors = new ArrayList<>();
    Map<Integer, UUID> resolvedAptIds = new HashMap<>();
    Map<Integer, byte[]> resolvedCpfBytes = new HashMap<>();

    for (int i = 0; i < req.entries().size(); i++) {
      var entry = req.entries().get(i);
      Optional<UUID> optAptId =
          apartmentRepository.findIdByCondoBlockUnit(
              condominiumId, entry.block(), entry.unitNumber());
      if (optAptId.isEmpty()) {
        errors.add(
            new BulkRowError(
                i,
                "apartment",
                "Apartamento Bloco "
                    + entry.block()
                    + " / "
                    + entry.unitNumber()
                    + " não encontrado"));
        continue;
      }
      try {
        byte[] cpfBytes = cpfEncryptor.encryptToBytes(entry.cpf());
        resolvedAptIds.put(i, optAptId.get());
        resolvedCpfBytes.put(i, cpfBytes);
      } catch (IllegalArgumentException e) {
        errors.add(new BulkRowError(i, "cpf", e.getMessage()));
      }
    }

    if (!errors.isEmpty()) {
      return new BulkResultResponse(0, List.of(), errors);
    }

    List<InvitationResponse> created = new ArrayList<>();
    for (int i = 0; i < req.entries().size(); i++) {
      var entry = req.entries().get(i);
      UUID aptId = resolvedAptIds.get(i);
      InvitationResponse resp =
          createOneInternal(condominiumId, aptId, entry.email(), entry.cpf(), entry.role(), userId);
      created.add(resp);
    }
    return new BulkResultResponse(created.size(), created, List.of());
  }

  @Transactional
  public InvitationResponse resend(UUID invitationId) {
    Invitation inv =
        invitationRepository
            .findById(invitationId)
            .orElseThrow(() -> new NotFoundException("Convite não encontrado"));
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, inv.condominiumId())) {
      throw new ForbiddenException("Apenas síndicos podem reenviar convites");
    }
    validateTenantOwnership(inv.condominiumId());

    if (!Set.of("PENDING", "EXPIRED", "BOUNCED").contains(inv.status())) {
      throw new ConflictException("Apenas convites PENDING/EXPIRED/BOUNCED podem ser reenviados");
    }

    invitationRepository.revokeAny(invitationId, userId);
    auditEventPublisher.publish(
        "INVITATION_REVOKED",
        "invitation",
        invitationId,
        Map.of("reason", "RESEND"),
        inv.condominiumId(),
        userId);

    String cpfPlain = cpfEncryptor.decryptFromBytes(inv.cpfEncrypted());
    CreateInvitationRequest newReq =
        new CreateInvitationRequest(inv.apartmentId(), inv.email(), cpfPlain, inv.role());
    return create(inv.condominiumId(), newReq);
  }

  @Transactional
  public void revoke(UUID invitationId) {
    Invitation inv =
        invitationRepository
            .findById(invitationId)
            .orElseThrow(() -> new NotFoundException("Convite não encontrado"));
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, inv.condominiumId())) {
      throw new ForbiddenException("Apenas síndicos podem revogar convites");
    }
    validateTenantOwnership(inv.condominiumId());

    if (!"PENDING".equals(inv.status())) {
      throw new ConflictException("Apenas convites pendentes podem ser revogados");
    }

    int rows = invitationRepository.revokePending(invitationId, userId);
    if (rows == 0) {
      throw new ConflictException("Convite não está mais pendente");
    }

    auditEventPublisher.publish(
        "INVITATION_REVOKED",
        "invitation",
        invitationId,
        Map.of("reason", "MANUAL"),
        inv.condominiumId(),
        userId);
  }

  @Transactional
  public InvitationResponse fixEmail(UUID invitationId, FixEmailRequest req) {
    Invitation inv =
        invitationRepository
            .findById(invitationId)
            .orElseThrow(() -> new NotFoundException("Convite não encontrado"));
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, inv.condominiumId())) {
      throw new ForbiddenException("Apenas síndicos podem corrigir e-mail de convites");
    }
    validateTenantOwnership(inv.condominiumId());

    if (!"BOUNCED".equals(inv.status())) {
      throw new ConflictException("fixEmail só se aplica a convites BOUNCED");
    }

    invitationRepository.revokeAny(invitationId, userId);
    auditEventPublisher.publish(
        "INVITATION_REVOKED",
        "invitation",
        invitationId,
        Map.of("reason", "BOUNCED_FIX_EMAIL", "previousEmail", inv.email()),
        inv.condominiumId(),
        userId);

    String cpfPlain = cpfEncryptor.decryptFromBytes(inv.cpfEncrypted());
    CreateInvitationRequest newReq =
        new CreateInvitationRequest(inv.apartmentId(), req.newEmail(), cpfPlain, inv.role());
    return create(inv.condominiumId(), newReq);
  }

  @Transactional(readOnly = true)
  public List<InvitationResponse> listByCondominium(
      UUID condominiumId, UUID apartmentId, String status) {
    UUID userId = authGateway.getCurrentUserId();
    if (!membershipRepository.isAdminOfTenant(userId, condominiumId)) {
      throw new ForbiddenException("Apenas síndicos podem listar convites");
    }

    List<Invitation> invs;
    if (apartmentId != null) {
      invs =
          invitationRepository.findByCondominiumIdAndApartmentIdOrderByCreatedAtDesc(
              condominiumId, apartmentId);
    } else if (status != null && !status.isBlank()) {
      invs = invitationRepository.findByCondominiumIdAndStatus(condominiumId, status);
    } else {
      invs = invitationRepository.findByCondominiumIdOrderByCreatedAtDesc(condominiumId);
    }
    return invs.stream().map(InvitationResponse::from).toList();
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private InvitationResponse createOneInternal(
      UUID condominiumId, UUID aptId, String email, String cpf, String role, UUID userId) {
    UUID id = UuidV7.generate();
    String token = UUID.randomUUID().toString();
    byte[] cpfBytes = cpfEncryptor.encryptToBytes(cpf);
    Instant expiresAt = Instant.now().plus(tokenTtlHours, ChronoUnit.HOURS);

    try {
      invitationRepository.insert(
          id, condominiumId, aptId, email, cpfBytes, role, expiresAt, userId);
    } catch (DataIntegrityViolationException e) {
      throw new ConflictException(
          "Já existe convite pendente para este e-mail neste apartamento e papel");
    }

    Map<String, Object> payload =
        Map.of(
            "invitationId", id.toString(),
            "email", email,
            "token", token,
            "apartmentId", aptId.toString(),
            "role", role,
            "expiresAt", expiresAt.toString(),
            "acceptUrl", buildAcceptUrl(token));
    String payloadJson;
    try {
      payloadJson = objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Erro ao serializar payload do convite", ex);
    }

    emailNotificationRepository.insert(
        UuidV7.generate(), userId, "INVITATION", payloadJson, Instant.now());

    redisCommands.setex("invitation:token:" + token, (long) tokenTtlHours * 3600L, id.toString());

    auditEventPublisher.publish(
        "INVITATION_SENT",
        "invitation",
        id,
        Map.of("email", email, "role", role, "apartmentId", aptId.toString()),
        condominiumId,
        userId);

    return InvitationResponse.from(
        invitationRepository
            .findById(id)
            .orElseThrow(
                () -> new IllegalStateException("Invitation recém-inserido não encontrado")));
  }

  private String buildAcceptUrl(String token) {
    String base =
        acceptBaseUrl.endsWith("/")
            ? acceptBaseUrl.substring(0, acceptBaseUrl.length() - 1)
            : acceptBaseUrl;
    return base + "/invitations/" + token;
  }

  private void validateTenantOwnership(UUID invitationCondoId) {
    UUID current = TenantContext.get();
    if (current == null || !current.equals(invitationCondoId)) {
      throw new ForbiddenException("Convite não pertence ao tenant atual");
    }
  }
}
