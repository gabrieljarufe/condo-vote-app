package com.condovote.onboarding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
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
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Instant;
import java.util.Map;
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

  /**
   * OWNER aceita convite → eligible_voter_user_id deve ser setado e audit publicado.
   *
   * <p>Invariante: condo-vote-principles.md §4 — OWNER ativo sem delegação → eligible_voter_user_id
   * = owner.user_id.
   */
  @Test
  @SuppressWarnings("unchecked")
  void complete_ownerAceitaConvite_setaEligibleVoterUserId() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID newUserId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    byte[] cpfBytes = {5, 6, 7};

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), anyString())).thenReturn(0L);
    when(supabaseAdminGateway.createUser(anyString(), anyString())).thenReturn(newUserId);
    when(cpfEncryptor.encryptToBytes(anyString())).thenReturn(cpfBytes);

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            "owner@example.com",
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

    // Todos os updates retornam 1 (includes: INSERT app_user, INSERT apartment_resident,
    // UPDATE apartment eligible_voter_user_id, UPDATE invitation)
    lenient().when(jdbcTemplate.update(anyString(), any(UUID.class), any(), any())).thenReturn(1);
    lenient()
        .when(jdbcTemplate.update(anyString(), any(UUID.class), any(), any(), any(), any(), any()))
        .thenReturn(1);
    lenient().when(jdbcTemplate.update(anyString(), any(UUID.class))).thenReturn(1);

    newService()
        .complete(
            new CompleteRegistrationRequest(token, "11144477735", "senha-forte-1!", "OWNER", true));

    // Verifica que o audit APARTMENT_ELIGIBLE_VOTER_SET foi publicado
    verify(auditEventPublisher)
        .publish(
            eq("APARTMENT_ELIGIBLE_VOTER_SET"),
            eq("apartment"),
            eq(aptId),
            any(Map.class),
            eq(condoId),
            eq(newUserId));
  }

  /**
   * TENANT aceita convite → eligible_voter_user_id NÃO deve ser tocado; nenhum audit
   * APARTMENT_ELIGIBLE_VOTER_SET publicado.
   *
   * <p>Delegação de TENANT é escopo H6.
   */
  @Test
  @SuppressWarnings("unchecked")
  void complete_tenantAceitaConvite_naoAlteraEligibleVoterUserId() {
    UUID invitationId = UUID.randomUUID();
    UUID condoId = UUID.randomUUID();
    UUID aptId = UUID.randomUUID();
    UUID newUserId = UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    byte[] cpfBytes = {5, 6, 7};

    when(redisCommands.get("invitation:token:" + token))
        .thenReturn(
            "{\"invitationId\":\"" + invitationId + "\",\"condominiumId\":\"" + condoId + "\"}");
    lenient()
        .when(jdbcTemplate.queryForObject(anyString(), eq(String.class), anyString()))
        .thenReturn("ok");
    when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), anyString())).thenReturn(0L);
    when(supabaseAdminGateway.createUser(anyString(), anyString())).thenReturn(newUserId);
    when(cpfEncryptor.encryptToBytes(anyString())).thenReturn(cpfBytes);

    Invitation inv =
        new Invitation(
            invitationId,
            condoId,
            aptId,
            "tenant@example.com",
            cpfBytes,
            "TENANT",
            "PENDING",
            Instant.now().plusSeconds(3600),
            null,
            null,
            null,
            UUID.randomUUID(),
            Instant.now());
    when(invitationRepository.findById(invitationId)).thenReturn(Optional.of(inv));

    lenient().when(jdbcTemplate.update(anyString(), any(UUID.class), any(), any())).thenReturn(1);
    lenient().when(jdbcTemplate.update(anyString(), any(UUID.class))).thenReturn(1);

    newService()
        .complete(
            new CompleteRegistrationRequest(
                token, "11144477735", "senha-forte-1!", "TENANT", true));

    // Nenhuma chamada de audit para APARTMENT_ELIGIBLE_VOTER_SET deve ter ocorrido
    verify(auditEventPublisher, never())
        .publish(
            eq("APARTMENT_ELIGIBLE_VOTER_SET"),
            anyString(),
            any(UUID.class),
            any(Map.class),
            any(UUID.class),
            any(UUID.class));
  }
}
