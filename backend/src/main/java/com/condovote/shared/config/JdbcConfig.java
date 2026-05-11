package com.condovote.shared.config;

import com.condovote.condominium.StringArrayToUserRoleSetConverter;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jdbc.core.convert.JdbcCustomConversions;
import org.springframework.data.jdbc.core.dialect.JdbcDialect;

@Configuration
public class JdbcConfig {
  @Bean
  public JdbcCustomConversions jdbcCustomConversions(JdbcDialect dialect) {
    return JdbcCustomConversions.of(dialect, List.of(new StringArrayToUserRoleSetConverter()));
  }
}
