package com.condovote.shared.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.condovote.AbstractIntegrationTest;
import io.lettuce.core.api.sync.RedisCommands;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.health.contributor.Status;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class RedisHealthIndicatorIT extends AbstractIntegrationTest {

  @Autowired RedisHealthIndicator indicator;

  @Autowired
  @SuppressWarnings("rawtypes")
  RedisCommands redisCommands;

  @Test
  @SuppressWarnings("unchecked")
  void upQuandoRedisResponde() {
    when(redisCommands.ping()).thenReturn("PONG");

    assertThat(indicator.health().getStatus()).isEqualTo(Status.UP);
  }

  @Test
  @SuppressWarnings("unchecked")
  void downQuandoRedisLancaExcecao() {
    when(redisCommands.ping()).thenThrow(new RuntimeException("timeout"));

    assertThat(indicator.health().getStatus()).isEqualTo(Status.DOWN);
  }

  @Test
  @SuppressWarnings("unchecked")
  void downQuandoRespostaInesperada() {
    when(redisCommands.ping()).thenReturn("ERR");

    assertThat(indicator.health().getStatus()).isEqualTo(Status.DOWN);
  }
}
