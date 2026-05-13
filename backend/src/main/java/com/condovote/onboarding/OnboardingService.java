package com.condovote.onboarding;

import com.condovote.apartment.Apartment;
import com.condovote.apartment.ApartmentRepository;
import com.condovote.auth.SupabaseAdminGateway;
import com.condovote.condominium.CondominiumRepository;
import com.condovote.invitation.Invitation;
import com.condovote.invitation.InvitationRepository;
import com.condovote.onboarding.dto.CompleteRegistrationRequest;
import com.condovote.onboarding.dto.CompleteRegistrationResponse;
import com.condovote.onboarding.dto.ValidateInvitationResponse;
import com.condovote.onboarding.dto.ValidateInvitationResponse.State;
import com.condovote.shared.UuidV7;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.crypto.CpfEncryptor;
import com.condovote.shared.exception.ConflictException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serviço público de aceite de convite. Não exige JWT — o token Redis é a credencial.
 *
 * <p>Por ser endpoint público, {@link com.condovote.shared.tenant.TenantContext} fica null e o
 * aspect de tenant não roda. Cada método @Transactional aqui seta manualmente {@code
 * app.current_tenant} via {@link JdbcTemplate} antes de qualquer SELECT/INSERT em tabela com RLS.
 */
@Service
public class OnboardingService {

  static final String CONSENT_POLICY_VERSION = "v1";

  private final RedisCommands<String, String> redisCommands;
  private final ObjectMapper objectMapper;
  private final JdbcTemplate jdbcTemplate;
  private final InvitationRepository invitationRepository;
  private final ApartmentRepository apartmentRepository;
  private final CondominiumRepository condominiumRepository;
  private final CpfEncryptor cpfEncryptor;
  private final SupabaseAdminGateway supabaseAdminGateway;
  private final AuditEventPublisher auditEventPublisher;

  public OnboardingService(
      RedisCommands<String, String> redisCommands,
      JdbcTemplate jdbcTemplate,
      InvitationRepository invitationRepository,
      ApartmentRepository apartmentRepository,
      CondominiumRepository condominiumRepository,
      CpfEncryptor cpfEncryptor,
      SupabaseAdminGateway supabaseAdminGateway,
      AuditEventPublisher auditEventPublisher) {
    this.redisCommands = redisCommands;
    this.objectMapper = new ObjectMapper();
    this.jdbcTemplate = jdbcTemplate;
    this.invitationRepository = invitationRepository;
    this.apartmentRepository = apartmentRepository;
    this.condominiumRepository = condominiumRepository;
    this.cpfEncryptor = cpfEncryptor;
    this.supabaseAdminGateway = supabaseAdminGateway;
    this.auditEventPublisher = auditEventPublisher;
  }

  @Transactional(readOnly = true)
  public ValidateInvitationResponse validate(String token) {
    TokenPayload payload = readToken(token);
    if (payload == null) {
      return ValidateInvitationResponse.of(State.NOT_FOUND);
    }
    setTenant(payload.condominiumId);

    Optional<Invitation> opt = invitationRepository.findById(payload.invitationId);
    if (opt.isEmpty()) {
      return ValidateInvitationResponse.of(State.NOT_FOUND);
    }
    Invitation inv = opt.get();
    return switch (inv.status()) {
      case "ACCEPTED" -> ValidateInvitationResponse.of(State.ALREADY_ACCEPTED);
      case "REVOKED" -> ValidateInvitationResponse.of(State.REVOKED);
      case "EXPIRED" -> ValidateInvitationResponse.of(State.EXPIRED);
      case "PENDING" -> {
        if (inv.expiresAt().isBefore(Instant.now())) {
          yield ValidateInvitationResponse.of(State.EXPIRED);
        }
        String aptLabel =
            apartmentRepository
                .findById(inv.apartmentId())
                .map(OnboardingService::formatAptLabel)
                .orElse("—");
        String condoName =
            condominiumRepository.findById(payload.condominiumId).map(c -> c.name()).orElse("—");
        yield new ValidateInvitationResponse(
            State.VALID, inv.email(), aptLabel, condoName, inv.role(), inv.expiresAt());
      }
      default -> ValidateInvitationResponse.of(State.NOT_FOUND);
    };
  }

  @Transactional
  public CompleteRegistrationResponse complete(CompleteRegistrationRequest req) {
    TokenPayload payload = readToken(req.token());
    if (payload == null) {
      throw new ConflictException("Convite inválido ou expirado");
    }
    setTenant(payload.condominiumId);

    Invitation inv =
        invitationRepository
            .findById(payload.invitationId)
            .orElseThrow(() -> new ConflictException("Convite inválido ou expirado"));

    if (!"PENDING".equals(inv.status())) {
      throw new ConflictException("Convite não está mais pendente (status=" + inv.status() + ")");
    }
    if (inv.expiresAt().isBefore(Instant.now())) {
      throw new ConflictException("Convite expirado");
    }

    byte[] cpfBytes;
    try {
      cpfBytes = cpfEncryptor.encryptToBytes(req.cpf());
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("CPF inválido: " + e.getMessage());
    }
    if (!Arrays.equals(cpfBytes, inv.cpfEncrypted())) {
      throw new IllegalArgumentException("CPF não confere com o convite");
    }

    Long existsByEmail =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM app_user WHERE lower(email) = lower(?)", Long.class, inv.email());
    if (existsByEmail != null && existsByEmail > 0) {
      throw new ConflictException("Já existe conta para este e-mail. Faça login.");
    }

    UUID authUserId = supabaseAdminGateway.createUser(inv.email(), req.password());

    jdbcTemplate.update(
        """
            INSERT INTO app_user
                (id, name, email, cpf_encrypted, is_active, consent_accepted_at, consent_policy_version, created_at)
            VALUES (?, ?, ?, ?, true, now(), ?, now())
            """,
        authUserId,
        req.fullName(),
        inv.email(),
        cpfBytes,
        CONSENT_POLICY_VERSION);

    jdbcTemplate.update(
        """
            INSERT INTO apartment_resident
                (id, condominium_id, apartment_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?, ?::resident_role, now())
            """,
        UuidV7.generate(),
        payload.condominiumId,
        inv.apartmentId(),
        authUserId,
        inv.role());

    int updated =
        jdbcTemplate.update(
            """
                UPDATE invitation
                SET status = 'ACCEPTED'::invitation_status, accepted_at = now()
                WHERE id = ? AND status = 'PENDING'::invitation_status
                """,
            payload.invitationId);
    if (updated == 0) {
      throw new ConflictException("Convite não está mais pendente");
    }

    redisCommands.del("invitation:token:" + req.token());

    auditEventPublisher.publish(
        "INVITATION_ACCEPTED",
        "invitation",
        payload.invitationId,
        Map.of(
            "email", inv.email(),
            "apartmentId", inv.apartmentId().toString(),
            "role", inv.role()),
        payload.condominiumId,
        authUserId);

    return new CompleteRegistrationResponse(authUserId);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private TokenPayload readToken(String token) {
    if (token == null || token.isBlank()) {
      return null;
    }
    String raw = redisCommands.get("invitation:token:" + token);
    if (raw == null) {
      return null;
    }
    try {
      Map<String, String> map = objectMapper.readValue(raw, new TokenTypeRef());
      String invId = map.get("invitationId");
      String condoId = map.get("condominiumId");
      if (invId == null || condoId == null) {
        return null;
      }
      return new TokenPayload(UUID.fromString(invId), UUID.fromString(condoId));
    } catch (JsonProcessingException | IllegalArgumentException e) {
      return null;
    }
  }

  private void setTenant(UUID condominiumId) {
    jdbcTemplate.queryForObject(
        "SELECT set_config('app.current_tenant', ?, true)", String.class, condominiumId.toString());
  }

  private static String formatAptLabel(Apartment apt) {
    String block = apt.block();
    if (block == null || block.isBlank()) {
      return "Apto " + apt.unitNumber();
    }
    return "Bloco " + block + " · Apto " + apt.unitNumber();
  }

  private record TokenPayload(UUID invitationId, UUID condominiumId) {}

  private static final class TokenTypeRef
      extends com.fasterxml.jackson.core.type.TypeReference<Map<String, String>> {}
}
