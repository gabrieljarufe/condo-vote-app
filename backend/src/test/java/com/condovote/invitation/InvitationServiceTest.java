package com.condovote.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.apartment.Apartment;
import com.condovote.apartment.ApartmentRepository;
import com.condovote.auth.AuthGateway;
import com.condovote.invitation.dto.BulkCreateInvitationRequest;
import com.condovote.invitation.dto.BulkInvitationEntry;
import com.condovote.invitation.dto.BulkResultResponse;
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
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class InvitationServiceTest {

  @Mock InvitationRepository invitationRepository;
  @Mock EmailNotificationRepository emailNotificationRepository;
  @Mock ApartmentRepository apartmentRepository;
  @Mock CpfEncryptor cpfEncryptor;
  @Mock AuditEventPublisher auditEventPublisher;
  @Mock TenantMembershipRepository membershipRepository;
  @Mock AuthGateway authGateway;
  @Mock RedisCommands<String, String> redisCommands;

  InvitationService service;

  UUID userId = UuidV7.generate();
  UUID condoId = UuidV7.generate();
  UUID aptId = UuidV7.generate();
  UUID invId = UuidV7.generate();

  Apartment apt;
  Invitation invSample;

  @BeforeEach
  void setup() {
    service =
        new InvitationService(
            invitationRepository,
            emailNotificationRepository,
            apartmentRepository,
            cpfEncryptor,
            auditEventPublisher,
            membershipRepository,
            authGateway,
            redisCommands,
            24,
            "http://localhost:4200");

    apt = new Apartment(aptId, condoId, "A", "101", null, false, Instant.now());
    invSample =
        new Invitation(
            invId,
            condoId,
            aptId,
            "morador@test.com",
            new byte[] {1, 2, 3},
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(86400),
            null,
            null,
            null,
            userId,
            Instant.now());

    lenient().when(authGateway.getCurrentUserId()).thenReturn(userId);
    TenantContext.set(condoId);
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  // ── create ────────────────────────────────────────────────────────────────

  @Test
  void create_admin_validApt_persistsAndPublishesAndSetsRedis() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(apt));
    when(cpfEncryptor.encryptToBytes("12345678901")).thenReturn(new byte[] {1, 2, 3});
    when(invitationRepository.findById(any())).thenReturn(Optional.of(invSample));

    var req = new CreateInvitationRequest(aptId, "morador@test.com", "12345678901", "OWNER");
    InvitationResponse result = service.create(condoId, req);

    verify(invitationRepository)
        .insert(
            any(),
            eq(condoId),
            eq(aptId),
            eq("morador@test.com"),
            any(byte[].class),
            eq("OWNER"),
            any(),
            eq(userId));
    verify(emailNotificationRepository)
        .insert(any(), eq(userId), eq("INVITATION"), anyString(), any());
    verify(redisCommands).setex(anyString(), anyLong(), anyString());
    verify(auditEventPublisher)
        .publish(eq("INVITATION_SENT"), eq("invitation"), any(), any(), eq(condoId), eq(userId));
    assertThat(result).isNotNull();
    assertThat(result.status()).isEqualTo("PENDING");
  }

  @Test
  void create_notAdmin_throwsForbidden() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(false);

    var req = new CreateInvitationRequest(aptId, "morador@test.com", "12345678901", "OWNER");
    assertThatThrownBy(() -> service.create(condoId, req)).isInstanceOf(ForbiddenException.class);

    verify(invitationRepository, never())
        .insert(any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void create_aptOfOtherCondo_throwsNotFound() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    UUID otherCondo = UuidV7.generate();
    Apartment otherApt = new Apartment(aptId, otherCondo, "A", "101", null, false, Instant.now());
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(otherApt));

    var req = new CreateInvitationRequest(aptId, "morador@test.com", "12345678901", "OWNER");
    assertThatThrownBy(() -> service.create(condoId, req)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void create_duplicatePending_throwsConflict() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(apt));
    when(cpfEncryptor.encryptToBytes("12345678901")).thenReturn(new byte[] {1, 2, 3});
    org.mockito.Mockito.doThrow(new DataIntegrityViolationException("duplicate key"))
        .when(invitationRepository)
        .insert(any(), any(), any(), any(), any(), any(), any(), any());

    var req = new CreateInvitationRequest(aptId, "morador@test.com", "12345678901", "OWNER");
    assertThatThrownBy(() -> service.create(condoId, req)).isInstanceOf(ConflictException.class);
  }

  // ── createBulk ────────────────────────────────────────────────────────────

  @Test
  void createBulk_allValid_persistsAll() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(apartmentRepository.findIdByCondoBlockUnit(condoId, "A", "101"))
        .thenReturn(Optional.of(aptId));
    when(apartmentRepository.findIdByCondoBlockUnit(condoId, "A", "102"))
        .thenReturn(Optional.of(UuidV7.generate()));
    when(cpfEncryptor.encryptToBytes(any())).thenReturn(new byte[] {1, 2, 3});
    when(invitationRepository.findById(any())).thenReturn(Optional.of(invSample));

    var entries =
        List.of(
            new BulkInvitationEntry("morador1@test.com", "12345678901", "A", "101", "OWNER"),
            new BulkInvitationEntry("morador2@test.com", "98765432100", "A", "102", "TENANT"));
    var req = new BulkCreateInvitationRequest(entries);
    BulkResultResponse result = service.createBulk(condoId, req);

    assertThat(result.created()).isEqualTo(2);
    assertThat(result.errors()).isEmpty();
    verify(invitationRepository, times(2))
        .insert(any(), any(), any(), any(), any(byte[].class), any(), any(), any());
  }

  @Test
  void createBulk_oneInvalidApt_returnsErrorsAndPersistsNone() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(apartmentRepository.findIdByCondoBlockUnit(condoId, "A", "999"))
        .thenReturn(Optional.empty());

    var entries =
        List.of(new BulkInvitationEntry("morador1@test.com", "12345678901", "A", "999", "OWNER"));
    var req = new BulkCreateInvitationRequest(entries);
    BulkResultResponse result = service.createBulk(condoId, req);

    assertThat(result.created()).isEqualTo(0);
    assertThat(result.errors()).hasSize(1);
    assertThat(result.errors().get(0).field()).isEqualTo("apartment");
    verify(invitationRepository, never())
        .insert(any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void createBulk_invalidCpf_returnsErrors() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(apartmentRepository.findIdByCondoBlockUnit(condoId, "A", "101"))
        .thenReturn(Optional.of(aptId));
    when(cpfEncryptor.encryptToBytes("00000000000"))
        .thenThrow(new IllegalArgumentException("CPF inválido"));

    var entries =
        List.of(new BulkInvitationEntry("morador1@test.com", "00000000000", "A", "101", "OWNER"));
    var req = new BulkCreateInvitationRequest(entries);
    BulkResultResponse result = service.createBulk(condoId, req);

    assertThat(result.errors()).hasSize(1);
    assertThat(result.errors().get(0).field()).isEqualTo("cpf");
    verify(invitationRepository, never())
        .insert(any(), any(), any(), any(), any(), any(), any(), any());
  }

  // ── revoke ────────────────────────────────────────────────────────────────

  @Test
  void revoke_pending_marksRevoked() {
    when(invitationRepository.findById(invId)).thenReturn(Optional.of(invSample));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(invitationRepository.revokePending(invId, userId)).thenReturn(1);

    service.revoke(invId);

    verify(invitationRepository).revokePending(invId, userId);
    verify(auditEventPublisher)
        .publish(
            eq("INVITATION_REVOKED"), eq("invitation"), eq(invId), any(), eq(condoId), eq(userId));
  }

  @Test
  void revoke_otherTenant_throwsForbidden() {
    UUID otherCondo = UuidV7.generate();
    TenantContext.set(otherCondo); // set different tenant

    Invitation inv =
        new Invitation(
            invId,
            condoId,
            aptId,
            "morador@test.com",
            new byte[] {1},
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(86400),
            null,
            null,
            null,
            userId,
            Instant.now());
    when(invitationRepository.findById(invId)).thenReturn(Optional.of(inv));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.revoke(invId)).isInstanceOf(ForbiddenException.class);
  }

  // ── resend ────────────────────────────────────────────────────────────────

  @Test
  void resend_pending_revokesAndCreatesNew() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(cpfEncryptor.decryptFromBytes(any(byte[].class))).thenReturn("12345678901");
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(apt));
    when(cpfEncryptor.encryptToBytes("12345678901")).thenReturn(new byte[] {1, 2, 3});
    when(invitationRepository.findById(any())).thenReturn(Optional.of(invSample));

    InvitationResponse result = service.resend(invId);

    verify(invitationRepository).revokeAny(invId, userId);
    verify(auditEventPublisher)
        .publish(
            eq("INVITATION_REVOKED"), eq("invitation"), eq(invId), any(), eq(condoId), eq(userId));
    verify(invitationRepository)
        .insert(
            any(),
            eq(condoId),
            eq(aptId),
            eq("morador@test.com"),
            any(byte[].class),
            eq("OWNER"),
            any(),
            eq(userId));
    assertThat(result).isNotNull();
  }

  @Test
  void resend_accepted_throwsConflict() {
    Invitation accepted =
        new Invitation(
            invId,
            condoId,
            aptId,
            "morador@test.com",
            new byte[] {1},
            "OWNER",
            "ACCEPTED",
            Instant.now().plusSeconds(86400),
            Instant.now(),
            null,
            null,
            userId,
            Instant.now());
    when(invitationRepository.findById(invId)).thenReturn(Optional.of(accepted));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.resend(invId)).isInstanceOf(ConflictException.class);
  }

  // ── fixEmail ──────────────────────────────────────────────────────────────

  @Test
  void fixEmail_bounced_revokesAndCreatesNewWithNewEmail() {
    Invitation bounced =
        new Invitation(
            invId,
            condoId,
            aptId,
            "old@test.com",
            new byte[] {1, 2, 3},
            "OWNER",
            "BOUNCED",
            Instant.now().plusSeconds(86400),
            null,
            null,
            null,
            userId,
            Instant.now());
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(cpfEncryptor.decryptFromBytes(any(byte[].class))).thenReturn("12345678901");
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.of(apt));
    when(cpfEncryptor.encryptToBytes("12345678901")).thenReturn(new byte[] {1, 2, 3});
    when(invitationRepository.findById(any())).thenReturn(Optional.of(bounced));

    InvitationResponse result = service.fixEmail(invId, new FixEmailRequest("new@test.com"));

    verify(invitationRepository).revokeAny(invId, userId);
    verify(invitationRepository)
        .insert(
            any(),
            eq(condoId),
            eq(aptId),
            eq("new@test.com"),
            any(byte[].class),
            eq("OWNER"),
            any(),
            eq(userId));
    assertThat(result).isNotNull();
  }

  @Test
  void fixEmail_pending_throwsConflict() {
    when(invitationRepository.findById(invId)).thenReturn(Optional.of(invSample));
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);

    assertThatThrownBy(() -> service.fixEmail(invId, new FixEmailRequest("new@test.com")))
        .isInstanceOf(ConflictException.class);
  }

  // ── listByCondominium ────────────────────────────────────────────────────

  @Test
  void list_byCondominium_returnsAll() {
    when(membershipRepository.isAdminOfTenant(userId, condoId)).thenReturn(true);
    when(invitationRepository.findByCondominiumIdOrderByCreatedAtDesc(condoId))
        .thenReturn(List.of(invSample));

    List<InvitationResponse> result = service.listByCondominium(condoId, null, null);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).email()).isEqualTo("morador@test.com");
  }
}
