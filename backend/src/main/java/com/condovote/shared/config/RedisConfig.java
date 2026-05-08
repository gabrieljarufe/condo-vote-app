package com.condovote.shared.config;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RedisConfig {

  @Value("${app.redis.url}")
  private String redisUrl;

  @Bean
  @ConditionalOnMissingBean
  public RedisClient redisClient() {
    return RedisClient.create(RedisURI.create(redisUrl));
  }

  @Bean
  @ConditionalOnMissingBean
  public StatefulRedisConnection<String, String> redisConnection(RedisClient redisClient) {
    return redisClient.connect();
  }

  @Bean
  @ConditionalOnMissingBean
  public RedisCommands<String, String> redisCommands(
      StatefulRedisConnection<String, String> connection) {
    return connection.sync();
  }
}
