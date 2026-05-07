package com.condovote.shared.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.condovote.shared.UuidV7;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifica que o isolamento por tenant via RLS funciona corretamente no banco.
 *
 * <p>Não usa Spring — JDBC puro com Testcontainers. Container próprio, separado do
 * AbstractIntegrationTest, porque este teste gerencia conexões fora do ciclo de vida do Spring (SET
 * ROLE, SET LOCAL em conexões manuais — incompatível com @Transactional).
 *
 * <p>Requer Docker rodando. Execute com: ./mvnw test -Dtest=RlsIsolationIT
 */
@Tag("integration")
@Testcontainers
class RlsIsolationIT {

  @Container
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>("postgres:16")
          .withDatabaseName("condovote_test")
          .withUsername("postgres")
          .withPassword("postgres");

  @BeforeAll
  static void setup() throws Exception {
    Flyway.configure()
        .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
        .locations("classpath:db/migration")
        .load()
        .migrate();

    // Cria role sem SUPERUSER nem BYPASSRLS — simula o role `postgres` do Supabase Cloud,
    // que diferente do Postgres local NÃO tem BYPASSRLS. RLS se aplica a este role.
    try (Connection conn = connect();
        Statement stmt = conn.createStatement()) {
      stmt.execute("CREATE ROLE condovote_app NOSUPERUSER NOBYPASSRLS");
      stmt.execute(
          "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO condovote_app");
      stmt.execute("GRANT USAGE ON SCHEMA public TO condovote_app");
    }
  }

  // --- Cenário 1: isolamento entre tenants ---

  @Test
  void selectRetornaApenasLinhasDoTenantAtivo() throws Exception {
    UUID condoA = UuidV7.generate();
    UUID condoB = UuidV7.generate();
    UUID aptA = UuidV7.generate();
    UUID aptB = UuidV7.generate();

    try (Connection conn = connect()) {
      insertCondominium(conn, condoA, "Condo A");
      insertCondominium(conn, condoB, "Condo B");
      insertApartment(conn, aptA, condoA, "101");
      insertApartment(conn, aptB, condoB, "101");
    }

    try (Connection conn = connect()) {
      conn.setAutoCommit(false);
      try (Statement stmt = conn.createStatement()) {
        stmt.execute("SET LOCAL ROLE condovote_app");
        stmt.execute("SET LOCAL app.current_tenant = '" + condoA + "'");

        List<UUID> ids = fetchApartmentIds(stmt);

        assertThat(ids).containsExactly(aptA);
        assertThat(ids).doesNotContain(aptB);
      }
      conn.rollback();
    }
  }

  // --- Cenário 2: sem tenant setado = 0 linhas ---

  @Test
  void selectSemTenantRetornaZeroLinhas() throws Exception {
    UUID condoC = UuidV7.generate();
    UUID aptC = UuidV7.generate();

    try (Connection conn = connect()) {
      insertCondominium(conn, condoC, "Condo C");
      insertApartment(conn, aptC, condoC, "201");
    }

    // current_setting retorna NULL → NULL::uuid não casa com nenhum condominium_id → 0 linhas
    try (Connection conn = connect()) {
      conn.setAutoCommit(false);
      try (Statement stmt = conn.createStatement()) {
        stmt.execute("SET LOCAL ROLE condovote_app");

        List<UUID> ids = fetchApartmentIds(stmt);

        assertThat(ids).isEmpty();
      }
      conn.rollback();
    }
  }

  // --- Cenário 3: FK composta rejeita condominium_id divergente em vote ---

  @Test
  void voteComCondominiumIdDivergenteFalhaComViolacaoDeFK() throws Exception {
    UUID condoD = UuidV7.generate();
    UUID condoE = UuidV7.generate();
    UUID aptD = UuidV7.generate();
    UUID pollD = UuidV7.generate();
    UUID optionD = UuidV7.generate();
    UUID syndicD = UuidV7.generate();

    try (Connection conn = connect()) {
      insertCondominium(conn, condoD, "Condo D");
      insertCondominium(conn, condoE, "Condo E");
      insertApartment(conn, aptD, condoD, "301");
      insertPoll(conn, pollD, condoD, syndicD);
      insertPollOption(conn, optionD, pollD);
    }

    // vote.condominium_id = condoE, mas poll.condominium_id = condoD
    // FK composta fk_vote_poll_tenant (poll_id, condominium_id) → poll deve rejeitar
    assertThatThrownBy(
            () -> {
              try (Connection conn = connect()) {
                insertVote(conn, UuidV7.generate(), pollD, condoE, aptD, optionD, syndicD);
              }
            })
        .isInstanceOf(SQLException.class)
        .hasMessageContaining("fk_vote_poll_tenant");
  }

  // --- helpers de conexão e fixtures ---

  private static Connection connect() throws SQLException {
    return DriverManager.getConnection(
        postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
  }

  private static List<UUID> fetchApartmentIds(Statement stmt) throws SQLException {
    List<UUID> ids = new ArrayList<>();
    try (ResultSet rs = stmt.executeQuery("SELECT id FROM apartment ORDER BY id")) {
      while (rs.next()) ids.add(rs.getObject("id", UUID.class));
    }
    return ids;
  }

  private static void insertCondominium(Connection conn, UUID id, String name) throws SQLException {
    try (PreparedStatement ps =
        conn.prepareStatement(
            "INSERT INTO condominium (id, name, address, created_at) VALUES (?, ?, 'Rua Test, 1', now())")) {
      ps.setObject(1, id);
      ps.setString(2, name);
      ps.executeUpdate();
    }
  }

  private static void insertApartment(Connection conn, UUID id, UUID condoId, String unit)
      throws SQLException {
    try (PreparedStatement ps =
        conn.prepareStatement(
            "INSERT INTO apartment (id, condominium_id, unit_number, is_delinquent, created_at) VALUES (?, ?, ?, false, now())")) {
      ps.setObject(1, id);
      ps.setObject(2, condoId);
      ps.setString(3, unit);
      ps.executeUpdate();
    }
  }

  private static void insertPoll(Connection conn, UUID id, UUID condoId, UUID createdBy)
      throws SQLException {
    try (PreparedStatement ps =
        conn.prepareStatement(
            "INSERT INTO poll (id, condominium_id, title, convocation, quorum_mode, status, created_by_user_id, created_at, updated_at) "
                + "VALUES (?, ?, 'Poll Test', 'FIRST'::convocation_type, 'ABSOLUTE_MAJORITY'::quorum_mode, 'DRAFT'::poll_status, ?, now(), now())")) {
      ps.setObject(1, id);
      ps.setObject(2, condoId);
      ps.setObject(3, createdBy);
      ps.executeUpdate();
    }
  }

  private static void insertPollOption(Connection conn, UUID id, UUID pollId) throws SQLException {
    try (PreparedStatement ps =
        conn.prepareStatement(
            "INSERT INTO poll_option (id, poll_id, label, display_order) VALUES (?, ?, 'Opção A', 1)")) {
      ps.setObject(1, id);
      ps.setObject(2, pollId);
      ps.executeUpdate();
    }
  }

  private static void insertVote(
      Connection conn,
      UUID id,
      UUID pollId,
      UUID condoId,
      UUID apartmentId,
      UUID optionId,
      UUID voterId)
      throws SQLException {
    try (PreparedStatement ps =
        conn.prepareStatement(
            "INSERT INTO vote (id, poll_id, condominium_id, apartment_id, poll_option_id, voter_user_id, voted_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, now())")) {
      ps.setObject(1, id);
      ps.setObject(2, pollId);
      ps.setObject(3, condoId);
      ps.setObject(4, apartmentId);
      ps.setObject(5, optionId);
      ps.setObject(6, voterId);
      ps.executeUpdate();
    }
  }
}
