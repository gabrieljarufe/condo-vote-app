package com.condovote.shared.tenant;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica que TenantTransactionAspect aplica SET LOCAL dentro de uma transação ativa.
 *
 * Usa um serviço de teste (@TestConfiguration) para expor um método @Transactional
 * que lê current_setting('app.current_tenant', true) — valor visível somente enquanto
 * a TX está aberta e SET LOCAL foi aplicado pelo aspecto.
 */
@Tag("integration")
@SpringBootTest
class TenantTransactionAspectIT extends AbstractIntegrationTest {

    @TestConfiguration
    static class TenantTestConfig {
        @Bean
        TenantSettingReader tenantSettingReader(JdbcTemplate jdbcTemplate) {
            return new TenantSettingReader(jdbcTemplate);
        }

        @Bean
        ClassLevelTransactionalService classLevelTransactionalService(JdbcTemplate jdbcTemplate) {
            return new ClassLevelTransactionalService(jdbcTemplate);
        }
    }

    // @Transactional no método — cenário padrão
    @Service
    static class TenantSettingReader {
        private final JdbcTemplate jdbcTemplate;

        TenantSettingReader(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
        }

        @Transactional
        public String readCurrentTenantSetting() {
            return jdbcTemplate.queryForObject(
                    "SELECT current_setting('app.current_tenant', true)",
                    String.class);
        }
    }

    // @Transactional na CLASSE — cenário que o pointcut @annotation não pegava antes do fix
    @Transactional
    static class ClassLevelTransactionalService {
        private final JdbcTemplate jdbcTemplate;

        ClassLevelTransactionalService(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
        }

        public String readCurrentTenantSetting() {
            return jdbcTemplate.queryForObject(
                    "SELECT current_setting('app.current_tenant', true)",
                    String.class);
        }
    }

    @Autowired
    TenantSettingReader tenantSettingReader;

    @Autowired
    ClassLevelTransactionalService classLevelTransactionalService;

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    void aspectoAplicaSetLocalQuandoTenantEstaNaContexto() {
        UUID tenantId = UuidV7.generate();
        TenantContext.set(tenantId);

        String setting = tenantSettingReader.readCurrentTenantSetting();

        assertThat(setting).isEqualTo(tenantId.toString());
    }

    @Test
    void semTenantNaContextoSettingEhNuloOuVazio() {
        // TenantContext não setado — aspecto não deve chamar SET LOCAL
        String setting = tenantSettingReader.readCurrentTenantSetting();

        assertThat(setting).isNullOrEmpty();
    }

    @Test
    void aspectoInterceptaTransactionalNivelDeClasse() {
        UUID tenantId = UuidV7.generate();
        TenantContext.set(tenantId);

        // Método sem @Transactional, mas classe anotada — @within deve interceptar
        String setting = classLevelTransactionalService.readCurrentTenantSetting();

        assertThat(setting).isEqualTo(tenantId.toString());
    }

    @Test
    void tenantNaoVazaEntreTransacoesDiferentes() {
        UUID tenantA = UuidV7.generate();
        UUID tenantB = UuidV7.generate();

        TenantContext.set(tenantA);
        String settingA = tenantSettingReader.readCurrentTenantSetting();

        TenantContext.set(tenantB);
        String settingB = tenantSettingReader.readCurrentTenantSetting();

        assertThat(settingA).isEqualTo(tenantA.toString());
        assertThat(settingB).isEqualTo(tenantB.toString());
        assertThat(settingA).isNotEqualTo(settingB);
    }
}
