package com.condovote.shared.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.lettuce.core.api.sync.RedisCommands;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.Status;

@ExtendWith(MockitoExtension.class)
class RedisHealthIndicatorTest {

  @Mock
  @SuppressWarnings("rawtypes")
  RedisCommands redisCommands;

  @InjectMocks RedisHealthIndicator indicator;

  @Test
  @SuppressWarnings("unchecked")
  void upQuandoPingRetornaPong() {
    when(redisCommands.ping()).thenReturn("PONG");

    Health health = indicator.health();

    assertThat(health.getStatus()).isEqualTo(Status.UP);
    assertThat(health.getDetails()).containsEntry("ping", "PONG");
  }

  @Test
  @SuppressWarnings("unchecked")
  void downQuandoPingRetornaValorInesperado() {
    when(redisCommands.ping()).thenReturn("ERR");

    Health health = indicator.health();

    assertThat(health.getStatus()).isEqualTo(Status.DOWN);
  }

  @Test
  @SuppressWarnings("unchecked")
  void downQuandoPingLancaExcecao() {
    when(redisCommands.ping()).thenThrow(new RuntimeException("Connection refused"));

    Health health = indicator.health();

    assertThat(health.getStatus()).isEqualTo(Status.DOWN);
  }
}
