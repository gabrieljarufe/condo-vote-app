package com.condovote.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.condovote.apartment.ApartmentRepository;
import com.condovote.auth.SupabaseAdminGateway;
import com.condovote.condominium.CondominiumRepository;
import com.condovote.invitation.Invitation;
import com.condovote.invitation.InvitationRepository;
import com.condovote.onboarding.dto.CompleteRegistrationRequest;
import com.condovote.onboarding.dto.ValidateInvitationResponse;
import com.condovote.shared.audit.AuditEventPublisher;
import com.condovote.shared.crypto.CpfEncryptor;
import com.condovote.shared.exception.ConflictException;
import com.condovote.shared.exception.ForbiddenException;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

@ExtendWith(MockitoExtension.class)
class OnboardingServiceTest {

  @Mock
  @SuppressWarnings("rawtypes")
  RedisCommands redisCommands;

  @Mock JdbcTemplate jdbcTemplate;
  @Mock InvitationRepository invitationRepository;
  @Mock ApartmentRepository apartmentRepository;
  @Mock CondominiumRepository condominiumRepository;
  @Mock CpfEncryptor cpfEncryptor;
  @Mock SupabaseAdminGateway supabaseAdminGateway;
  @Mock AuditEventPublisher auditEventPublisher;

  @SuppressWarnings("unchecked")
  private OnboardingService newService() {
    return new OnboardingService(
        redisCommands,
        jdbcTemplate,
        invitationRepository,
        apartmentRepository,
        condominiumRepository,
        cpfEncryptor,
        supabaseAdminGateway,
        auditEventPublisher);
  }

  @Test
  @SuppressWarnings("unchecked")
  void validate_tokenInexistente_retornaNOT_FOUND() {
    when(redisCommands.get(anyString())).thenReturn(null);
    ValidateInvitationResponse resp = newService().validate("abc");
    assertThat(resp.state()).isEqualTo(ValidateInvitationResponse.State.NOT_FOUND);
  }

  @Test
  @SuppressWarnings("unchecked")
  void validate_pending_emailComConta_retornaEmailHasAccountTrue() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    String email = "morador@example.com";

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(Long.class), eq(email)))
        .thenReturn(1L);

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            email,
            new byte[] {1, 2, 3},
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(3600),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.empty());
    when(condominiumRepository.findById(condoId)).thenReturn(Optional.empty());

    ValidateInvitationResponse resp = newService().validate(token);

    assertThat(resp.state()).isEqualTo(ValidateInvitationResponse.State.VALID);
    assertThat(resp.emailHasAccount()).isTrue();
    assertThat(resp.email()).isEqualTo(email);
  }

  @Test
  @SuppressWarnings("unchecked")
  void validate_pending_emailSemConta_retornaEmailHasAccountFalse() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    String email = "novo@example.com";

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(Long.class), eq(email)))
        .thenReturn(0L);

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            email,
            new byte[] {1, 2, 3},
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(3600),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));
    when(apartmentRepository.findById(aptId)).thenReturn(Optional.empty());
    when(condominiumRepository.findById(condoId)).thenReturn(Optional.empty());

    ValidateInvitationResponse resp = newService().validate(token);

    assertThat(resp.state()).isEqualTo(ValidateInvitationResponse.State.VALID);
    assertThat(resp.emailHasAccount()).isFalse();
  }

  @Test
  @SuppressWarnings("unchecked")
  void complete_cpfNaoConfere_lancaIllegalArgument() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            "a@x.com",
            new byte[] {1, 2, 3},
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(3600),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));
    when(cpfEncryptor.encryptToBytes("11144477735")).thenReturn(new byte[] {9, 9, 9});

    assertThatThrownBy(
            () ->
                newService()
                    .complete(
                        new CompleteRegistrationRequest(
                            token, "11144477735", "senha-forte-1!", "Nome", true)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("CPF não confere");
  }

  @Test
  @SuppressWarnings("unchecked")
  void complete_invitationJaAceito_lancaConflict() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            "a@x.com",
            new byte[] {1, 2, 3},
            "OWNER",
            "ACCEPTED",
            Instant.now().plusSeconds(3600),
            Instant.now(),
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));

    assertThatThrownBy(
            () ->
                newService()
                    .complete(
                        new CompleteRegistrationRequest(
                            token, "11144477735", "senha-forte-1!", "Nome", true)))
        .isInstanceOf(ConflictException.class);
  }

  @Test
  @SuppressWarnings("unchecked")
  void complete_tokenInexistente_lancaConflict() {
    when(redisCommands.get(anyString())).thenReturn(null);
    assertThatThrownBy(
            () ->
                newService()
                    .complete(
                        new CompleteRegistrationRequest(
                            "x", "11144477735", "senha-forte-1!", "Nome", true)))
        .isInstanceOf(ConflictException.class);
  }

  @Test
  @SuppressWarnings("unchecked")
  void complete_happyPath_emiteInvitationAcceptedERESIDENT_JOINED() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID newUserId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    String email = "novo@example.com";
    byte[] cpfBytes = new byte[] {1, 2, 3};

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(Long.class), eq(email)))
        .thenReturn(0L);

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            email,
            cpfBytes,
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(3600),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));
    when(cpfEncryptor.encryptToBytes("111.444.777-35")).thenReturn(cpfBytes);
    when(supabaseAdminGateway.createUser(email, "senha-forte-1!")).thenReturn(newUserId);
    lenient()
        .when(jdbcTemplate.update(contains("UPDATE invitation"), eq(invitationId)))
        .thenReturn(1);

    newService()
        .complete(
            new CompleteRegistrationRequest(
                token, "111.444.777-35", "senha-forte-1!", "Nome Completo", true));

    ArgumentCaptor<Map<String, Object>> payloadCap = ArgumentCaptor.forClass(Map.class);
    ArgumentCaptor<String> typeCap = ArgumentCaptor.forClass(String.class);
    verify(auditEventPublisher, times(2))
        .publish(
            typeCap.capture(),
            anyString(),
            any(UUID.class),
            payloadCap.capture(),
            eq(condoId),
            eq(newUserId));
    assertThat(typeCap.getAllValues()).containsExactly("INVITATION_ACCEPTED", "RESIDENT_JOINED");
    assertThat(payloadCap.getAllValues().get(0))
        .contains(entry("flow", "CREATE_NEW_USER"))
        .contains(entry("email", email));
    assertThat(payloadCap.getAllValues().get(1))
        .contains(entry("via", "INVITATION"))
        .contains(entry("userId", newUserId.toString()))
        .contains(entry("invitationId", invitationId.toString()));
  }

  @Test
  @SuppressWarnings("unchecked")
  void complete_emailJaExiste_mensagemSugereLogin() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    String email = "existente@example.com";
    byte[] cpfBytes = new byte[] {1, 2, 3};

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(Long.class), eq(email)))
        .thenReturn(1L);

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            email,
            cpfBytes,
            "OWNER",
            "PENDING",
            Instant.now().plusSeconds(3600),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));
    when(cpfEncryptor.encryptToBytes("111.444.777-35")).thenReturn(cpfBytes);

    assertThatThrownBy(
            () ->
                newService()
                    .complete(
                        new CompleteRegistrationRequest(
                            token, "111.444.777-35", "senha-forte-1!", "Nome", true)))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("Faça login para aceitar este convite");
  }

  // ──────────────────────────── acceptAsExistingUser ────────────────────────────

  private Invitation pendingInv(
      UUID invId, UUID condoId, UUID aptId, String email, byte[] cpfBytes) {
    return new Invitation(
        invId,
        condoId,
        aptId,
        email,
        cpfBytes,
        "OWNER",
        "PENDING",
        Instant.now().plusSeconds(3600),
        null,
        null,
        null,
        UUID.randomUUID(),
        Instant.now());
  }

  @SuppressWarnings("unchecked")
  private void stubTokenAndInvitation(String token, Invitation inv) {
    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\""
                + inv.id()
                + "\",\"condominiumId\":\""
                + inv.condominiumId()
                + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(invitationRepository.findById(inv.id())).thenReturn(Optional.of(inv));
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_happyPath_insereResidenteEEmite2Eventos() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    String email = "morador@example.com";
    String token = UUID.randomUUID().toString();
    byte[] cpfBytes = new byte[] {1, 2, 3};

    Invitation inv = pendingInv(invId, condoId, aptId, email, cpfBytes);
    stubTokenAndInvitation(token, inv);

    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(byte[].class), eq(jwtUserId)))
        .thenReturn(cpfBytes);
    when(cpfEncryptor.encryptToBytes("111.444.777-35")).thenReturn(cpfBytes);
    // SELECT-before-INSERT em apartment_resident → não existe ainda.
    when(jdbcTemplate.query(
            contains("FROM apartment_resident"),
            any(ResultSetExtractor.class),
            eq(aptId),
            eq(jwtUserId)))
        .thenReturn(Optional.empty());
    lenient().when(jdbcTemplate.update(contains("UPDATE invitation"), eq(invId))).thenReturn(1);

    newService().acceptAsExistingUser(token, "111.444.777-35", email, jwtUserId);

    ArgumentCaptor<Map<String, Object>> payloadCap = ArgumentCaptor.forClass(Map.class);
    ArgumentCaptor<String> typeCap = ArgumentCaptor.forClass(String.class);
    verify(auditEventPublisher, times(2))
        .publish(
            typeCap.capture(),
            anyString(),
            any(UUID.class),
            payloadCap.capture(),
            eq(condoId),
            eq(jwtUserId));
    assertThat(typeCap.getAllValues()).containsExactly("INVITATION_ACCEPTED", "RESIDENT_JOINED");
    assertThat(payloadCap.getAllValues().get(0))
        .contains(entry("flow", "LINK_EXISTING_USER"))
        .contains(entry("email", email));
    assertThat(payloadCap.getAllValues().get(1))
        .contains(entry("via", "INVITATION"))
        .contains(entry("userId", jwtUserId.toString()));

    verify(redisCommands).del("invitation:token:" + token);
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_emailJwtDivergeDoConvite_lancaForbidden() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();

    Invitation inv = pendingInv(invId, condoId, aptId, "convite@x.com", new byte[] {1});
    stubTokenAndInvitation(token, inv);

    assertThatThrownBy(
            () ->
                newService()
                    .acceptAsExistingUser(token, "111.444.777-35", "outro@y.com", jwtUserId))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("outro e-mail");
    verify(auditEventPublisher, never())
        .publish(
            anyString(), anyString(), any(UUID.class), any(), any(UUID.class), any(UUID.class));
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_cpfNaoConfere_lancaIllegalArgument() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    String email = "a@x.com";
    String token = UUID.randomUUID().toString();

    Invitation inv = pendingInv(invId, condoId, aptId, email, new byte[] {1});
    stubTokenAndInvitation(token, inv);
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(byte[].class), eq(jwtUserId)))
        .thenReturn(new byte[] {9, 9, 9});
    when(cpfEncryptor.encryptToBytes("111.444.777-35")).thenReturn(new byte[] {1, 2, 3});

    assertThatThrownBy(
            () -> newService().acceptAsExistingUser(token, "111.444.777-35", email, jwtUserId))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("CPF não confere");
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_invitationExpirado_lancaConflict() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    String email = "a@x.com";
    String token = UUID.randomUUID().toString();

    Invitation inv =
        new Invitation(
            invId,
            condoId,
            aptId,
            email,
            new byte[] {1},
            "OWNER",
            "PENDING",
            Instant.now().minusSeconds(60),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    stubTokenAndInvitation(token, inv);

    assertThatThrownBy(
            () -> newService().acceptAsExistingUser(token, "111.444.777-35", email, jwtUserId))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("expirado");
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_invitationAccepted_lancaConflict() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    String email = "a@x.com";
    String token = UUID.randomUUID().toString();

    Invitation inv =
        new Invitation(
            invId,
            condoId,
            aptId,
            email,
            new byte[] {1},
            "OWNER",
            "ACCEPTED",
            Instant.now().plusSeconds(3600),
            Instant.now(),
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    stubTokenAndInvitation(token, inv);

    assertThatThrownBy(
            () -> newService().acceptAsExistingUser(token, "111.444.777-35", email, jwtUserId))
        .isInstanceOf(ConflictException.class);
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_userNaoEncontrado_lancaConflict() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    String email = "a@x.com";
    String token = UUID.randomUUID().toString();

    Invitation inv = pendingInv(invId, condoId, aptId, email, new byte[] {1});
    stubTokenAndInvitation(token, inv);
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(byte[].class), eq(jwtUserId)))
        .thenThrow(new EmptyResultDataAccessException(1));

    assertThatThrownBy(
            () -> newService().acceptAsExistingUser(token, "111.444.777-35", email, jwtUserId))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("Conta não encontrada");
  }

  @Test
  @SuppressWarnings("unchecked")
  void acceptAsExisting_idempotente_naoCriaResidenteESoEmiteInvitationAccepted() {
    UUID invId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID jwtUserId = UUID.randomUUID();
    UUID existingResidentId = UUID.randomUUID();
    String email = "a@x.com";
    String token = UUID.randomUUID().toString();
    byte[] cpfBytes = new byte[] {1, 2, 3};

    Invitation inv = pendingInv(invId, condoId, aptId, email, cpfBytes);
    stubTokenAndInvitation(token, inv);
    when(jdbcTemplate.queryForObject(contains("FROM app_user"), eq(byte[].class), eq(jwtUserId)))
        .thenReturn(cpfBytes);
    when(cpfEncryptor.encryptToBytes("111.444.777-35")).thenReturn(cpfBytes);
    when(jdbcTemplate.query(
            contains("FROM apartment_resident"),
            any(ResultSetExtractor.class),
            eq(aptId),
            eq(jwtUserId)))
        .thenReturn(Optional.of(existingResidentId));
    lenient().when(jdbcTemplate.update(contains("UPDATE invitation"), eq(invId))).thenReturn(1);

    newService().acceptAsExistingUser(token, "111.444.777-35", email, jwtUserId);

    // Não deve haver INSERT em apartment_resident.
    verify(jdbcTemplate, never())
        .update(contains("INSERT INTO apartment_resident"), any(Object[].class));

    // Apenas um evento INVITATION_ACCEPTED com flow LINK_EXISTING_USER_IDEMPOTENT.
    ArgumentCaptor<Map<String, Object>> payloadCap = ArgumentCaptor.forClass(Map.class);
    ArgumentCaptor<String> typeCap = ArgumentCaptor.forClass(String.class);
    verify(auditEventPublisher, times(1))
        .publish(
            typeCap.capture(),
            anyString(),
            any(UUID.class),
            payloadCap.capture(),
            eq(condoId),
            eq(jwtUserId));
    assertThat(typeCap.getValue()).isEqualTo("INVITATION_ACCEPTED");
    assertThat(payloadCap.getValue()).contains(entry("flow", "LINK_EXISTING_USER_IDEMPOTENT"));
  }
}
