package com.condovote.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.condovote.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.json.JsonWriter;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class SensitiveDataMaskingCustomizerIT extends AbstractIntegrationTest {

  @Test
  void cpfFormatatoEMascaradoComContextoSpringAtivo() {
    assertThat(SensitiveDataMaskingCustomizer.mask("CPF 123.456.789-00 acessou"))
        .contains("***.***.***-00")
        .doesNotContain("123.456");
  }

  @Test
  void bearerTokenEMascaradoComContextoSpringAtivo() {
    assertThat(SensitiveDataMaskingCustomizer.mask("Authorization: Bearer eyJabc.def.ghi"))
        .contains("Bearer ***")
        .doesNotContain("eyJabc");
  }

  @Test
  @SuppressWarnings("unchecked")
  void customizeRegistraValueProcessorComContextoSpringAtivo() {
    var customizer = new SensitiveDataMaskingCustomizer();
    JsonWriter.Members<ILoggingEvent> members = mock(JsonWriter.Members.class);
    customizer.customize(members);
    verify(members).applyingValueProcessor(any());
  }

  @Test
  void customizadorMascaraMensagemEmEventoLogback() {
    Logger logger = (Logger) LoggerFactory.getLogger(SensitiveDataMaskingCustomizerIT.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);

    try {
      logger.info("Acesso com CPF 123.456.789-00 detectado");
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }

    assertThat(appender.list).isNotEmpty();
    // O evento bruto preserva a mensagem original; o mascaramento ocorre na serialização JSON.
    // Aqui verificamos que o event foi capturado — e que mask() transforma a mensagem corretamente.
    String rawMessage = appender.list.get(0).getFormattedMessage();
    assertThat(SensitiveDataMaskingCustomizer.mask(rawMessage))
        .contains("***.***.***-00")
        .doesNotContain("123.456");
  }
}
