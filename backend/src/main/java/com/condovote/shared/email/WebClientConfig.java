package com.condovote.shared.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
class WebClientConfig {

  @Bean
  @ConditionalOnMissingBean
  WebClient.Builder webClientBuilder() {
    return WebClient.builder();
  }
}
