package com.condovote.shared.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.crypto.CpfEncryptor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

/**
 * Valida que o template V1001 aplica sem erro no schema real (Testcontainers) e que o CpfEncryptor
 * produz ciphertext compatível com BYTEA do PostgreSQL.
 *
 * <p>O SQL é executado em transação com rollback automático — o banco fica limpo após o teste.
 */
@SpringBootTest
@Transactional
@Rollback
class BootstrapTemplateIT extends AbstractIntegrationTest {

  @Autowired JdbcClient jdbcClient;

  @Autowired CpfEncryptor cpfEncryptor;

  /** CPF de teste (11 dígitos, não pertence a pessoa real). */
  private static final String TEST_CPF = "12345678901";

  // UUIDs v7 gerados offline apenas para este teste
  private static final String CONDO_ID = "01960000-0000-7000-8000-000000000001";
  private static final String USER_ID = "01960000-0000-7000-8000-000000000002";
  private static final String ADMIN_ID = "01960000-0000-7000-8000-000000000003";
  private static final String AUDIT_ID = "01960000-0000-7000-8000-000000000004";

  @Test
  void bootstrapTemplateSqlDeveAplicarSemErro() {
    String cpfHex = cpfEncryptor.encrypt(TEST_CPF);

    assertThatCode(
            () -> {
              // 1. Condomínio
              jdbcClient
                  .sql("INSERT INTO condominium (id, name, address) VALUES (?, ?, ?)")
                  .params(
                      java.util.UUID.fromString(CONDO_ID),
                      "Condomínio Teste Bootstrap",
                      "Rua de Teste, 1, Bairro, Cidade, UF")
                  .update();

              // 2. app_user (síndico)
              jdbcClient
                  .sql(
                      """
                      INSERT INTO app_user
                        (id, name, email, cpf_encrypted, consent_accepted_at, consent_policy_version)
                      VALUES (?, ?, ?, decode(?, 'hex'), now(), 'v1')
                      """)
                  .params(
                      java.util.UUID.fromString(USER_ID),
                      "Síndico Teste",
                      "sindico-teste@condovote.test",
                      cpfHex.toLowerCase())
                  .update();

              // 3. Vínculo administrador
              jdbcClient
                  .sql(
                      "INSERT INTO condominium_admin (id, condominium_id, user_id) VALUES (?, ?, ?)")
                  .params(
                      java.util.UUID.fromString(ADMIN_ID),
                      java.util.UUID.fromString(CONDO_ID),
                      java.util.UUID.fromString(USER_ID))
                  .update();

              // 4. Auditoria do bootstrap
              jdbcClient
                  .sql(
                      """
                      INSERT INTO audit_event
                        (id, condominium_id, actor_user_id, event_type, entity_type, entity_id, payload)
                      VALUES (?, ?, '00000000-0000-0000-0000-000000000001'::uuid,
                              'ADMIN_GRANTED', 'CONDOMINIUM_ADMIN', ?,
                              jsonb_build_object(
                                'source',    'BOOTSTRAP_MIGRATION',
                                'migration', 'V1001__bootstrap_teste',
                                'operator',  'operador-teste'
                              ))
                      """)
                  .params(
                      java.util.UUID.fromString(AUDIT_ID),
                      java.util.UUID.fromString(CONDO_ID),
                      java.util.UUID.fromString(USER_ID))
                  .update();
            })
        .doesNotThrowAnyException();

    // Verifica que as linhas foram inseridas dentro da transação
    int condoCount =
        jdbcClient
            .sql("SELECT COUNT(*) FROM condominium WHERE id = ?::uuid")
            .param(CONDO_ID)
            .query(Integer.class)
            .single();
    assertThat(condoCount).isEqualTo(1);

    int adminCount =
        jdbcClient
            .sql("SELECT COUNT(*) FROM condominium_admin WHERE condominium_id = ?::uuid")
            .param(CONDO_ID)
            .query(Integer.class)
            .single();
    assertThat(adminCount).isEqualTo(1);

    int auditCount =
        jdbcClient
            .sql("SELECT COUNT(*) FROM audit_event WHERE condominium_id = ?::uuid")
            .param(CONDO_ID)
            .query(Integer.class)
            .single();
    assertThat(auditCount).isEqualTo(1);
  }

  /**
   * Síndico já existe em app_user com o mesmo UUID e mesmo email (cenário cross-condo legítimo). O
   * bloco DO $$ deve ser noop — sem exception, COUNT permanece 1.
   */
  @Test
  void bootstrapTemplateSyndicoJaExisteComMesmoEmail_deveSerNoop() {
    String cpfHex = cpfEncryptor.encrypt(TEST_CPF);

    // Pré-inserir o síndico como se já estivesse bootstrapado em outro condo
    jdbcClient
        .sql(
            """
            INSERT INTO app_user
              (id, name, email, cpf_encrypted, consent_accepted_at, consent_policy_version)
            VALUES (?, ?, ?, decode(?, 'hex'), now(), 'v1')
            """)
        .params(
            java.util.UUID.fromString(USER_ID),
            "Síndico Existente",
            "sindico-teste@condovote.test",
            cpfHex.toLowerCase())
        .update();

    // Executar o bloco DO $$ com mesmo UUID e mesmo email → deve ser noop
    String doBlock =
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = '%s'::uuid) THEN
            INSERT INTO app_user (id, name, email, cpf_encrypted, consent_accepted_at, consent_policy_version)
            VALUES ('%s', 'Síndico Existente', 'sindico-teste@condovote.test', '\\x00'::bytea, now(), 'v1');
          ELSIF EXISTS (SELECT 1 FROM app_user WHERE id = '%s'::uuid
                        AND email = 'sindico-teste@condovote.test') THEN
            NULL; -- mesmo UUID, mesmo email → noop (síndico cross-condo)
          ELSE
            RAISE EXCEPTION 'UUID %% já existe com email diferente — operador colou UUID errado?',
                            '%s';
          END IF;
        END $$;
        """
            .formatted(USER_ID, USER_ID, USER_ID, USER_ID);

    assertThatCode(() -> jdbcClient.sql(doBlock).update()).doesNotThrowAnyException();

    int count =
        jdbcClient
            .sql("SELECT COUNT(*) FROM app_user WHERE id = ?::uuid")
            .param(USER_ID)
            .query(Integer.class)
            .single();
    assertThat(count).isEqualTo(1);
  }

  /**
   * Mesmo UUID já existe em app_user mas com email diferente — operador colou UUID errado. O bloco
   * DO $$ deve lançar DataAccessException contendo a mensagem de erro explícita.
   */
  @Test
  void bootstrapTemplateSyndicoComUuidColidindoComEmailDivergente_deveLancarExcecao() {
    String cpfHex = cpfEncryptor.encrypt(TEST_CPF);

    // Pré-inserir o síndico com email A
    jdbcClient
        .sql(
            """
            INSERT INTO app_user
              (id, name, email, cpf_encrypted, consent_accepted_at, consent_policy_version)
            VALUES (?, ?, ?, decode(?, 'hex'), now(), 'v1')
            """)
        .params(
            java.util.UUID.fromString(USER_ID),
            "Síndico Original",
            "email-original@condovote.test",
            cpfHex.toLowerCase())
        .update();

    // Executar o bloco DO $$ com mesmo UUID mas email diferente (email B) → deve lançar exception
    String doBlock =
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = '%s'::uuid) THEN
            INSERT INTO app_user (id, name, email, cpf_encrypted, consent_accepted_at, consent_policy_version)
            VALUES ('%s', 'Outro Síndico', 'email-diferente@condovote.test', '\\x00'::bytea, now(), 'v1');
          ELSIF EXISTS (SELECT 1 FROM app_user WHERE id = '%s'::uuid
                        AND email = 'email-diferente@condovote.test') THEN
            NULL;
          ELSE
            RAISE EXCEPTION 'UUID %% já existe com email diferente — operador colou UUID errado?',
                            '%s';
          END IF;
        END $$;
        """
            .formatted(USER_ID, USER_ID, USER_ID, USER_ID);

    assertThatThrownBy(() -> jdbcClient.sql(doBlock).update())
        .isInstanceOf(DataAccessException.class)
        .hasMessageContaining("operador colou UUID errado");
  }

  @Test
  void cpfEncryptorDeveProuzirHexCompativelComBytea() {
    String cpfHex = cpfEncryptor.encrypt(TEST_CPF);

    // Se decode() aceitar o hex sem erro, o formato é compatível com BYTEA
    Integer resultado =
        jdbcClient
            .sql("SELECT length(decode(?, 'hex'))")
            .param(cpfHex.toLowerCase())
            .query(Integer.class)
            .single();

    assertThat(resultado).isPositive();
  }
}
