package com.condovote.shared.config;

import com.condovote.condominium.StringArrayToUserRoleSetConverter;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jdbc.core.convert.JdbcCustomConversions;

@Configuration
public class JdbcConfig {
  @Bean
  public JdbcCustomConversions jdbcCustomConversions() {
    return new JdbcCustomConversions(List.of(new StringArrayToUserRoleSetConverter()));
  }
}
