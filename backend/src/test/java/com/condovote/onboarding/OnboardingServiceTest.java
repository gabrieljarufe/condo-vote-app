package com.condovote.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
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
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

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
                            token, "11144477735", "senha-forte-1!", "Nome")))
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
                            token, "11144477735", "senha-forte-1!", "Nome")))
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
                            "x", "11144477735", "senha-forte-1!", "Nome")))
        .isInstanceOf(ConflictException.class);
  }
}
