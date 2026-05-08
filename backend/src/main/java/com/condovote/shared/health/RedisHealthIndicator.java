package com.condovote.shared.health;

import io.lettuce.core.api.sync.RedisCommands;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("redis")
public class RedisHealthIndicator implements HealthIndicator {

  private final RedisCommands<String, String> redisCommands;

  public RedisHealthIndicator(RedisCommands<String, String> redisCommands) {
    this.redisCommands = redisCommands;
  }

  @Override
  public Health health() {
    try {
      String response = redisCommands.ping();
      if ("PONG".equalsIgnoreCase(response)) {
        return Health.up().withDetail("ping", response).build();
      }
      return Health.down().withDetail("ping", response).build();
    } catch (Exception ex) {
      return Health.down(ex).build();
    }
  }
}
