package com.condovote.shared.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Value("${app.cors.allowed-origins:}")
  private String allowedOrigins;

  @Value("${app.actuator.username}")
  private String actuatorUsername;

  @Value("${app.actuator.password}")
  private String actuatorPassword;

  @Bean
  @Order(1)
  public SecurityFilterChain actuatorFilterChain(HttpSecurity http) throws Exception {
    http.securityMatcher("/actuator/**")
        .csrf(csrf -> csrf.disable())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/health/liveness")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .httpBasic(basic -> {});
    return http.build();
  }

  /** Cadeia principal — JWT para todos os outros endpoints. */
  @Bean
  @Order(2)
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .headers(
            headers ->
                headers
                    .frameOptions(frame -> frame.deny())
                    .httpStrictTransportSecurity(
                        hsts -> hsts.maxAgeInSeconds(31_536_000).includeSubDomains(true)))
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers("/api/public/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> {}));
    return http.build();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
  }

  @Bean
  public UserDetailsService actuatorUserDetailsService(PasswordEncoder encoder) {
    var user =
        User.withUsername(actuatorUsername)
            .password(encoder.encode(actuatorPassword))
            .roles("ACTUATOR")
            .build();
    return new InMemoryUserDetailsManager(user);
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();

    if (allowedOrigins != null && !allowedOrigins.isBlank()) {
      config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
    }

    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    config.setAllowedHeaders(
        List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE, "X-Tenant-Id"));
    config.setAllowCredentials(false);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
