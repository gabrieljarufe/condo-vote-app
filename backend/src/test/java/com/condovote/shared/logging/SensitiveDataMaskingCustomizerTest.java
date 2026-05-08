package com.condovote.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import ch.qos.logback.classic.spi.ILoggingEvent;
import org.junit.jupiter.api.Test;
import org.springframework.boot.json.JsonWriter;

class SensitiveDataMaskingCustomizerTest {

  @Test
  void cpfFormatadoEhMascarado() {
    String result = SensitiveDataMaskingCustomizer.mask("Cliente CPF 123.456.789-00 acessou");

    assertThat(result).contains("***.***.***-00");
    assertThat(result).doesNotContain("123.456");
  }

  @Test
  void bearerTokenEhMascarado() {
    String result = SensitiveDataMaskingCustomizer.mask("Authorization: Bearer eyJabc.def.ghi");

    assertThat(result).contains("Bearer ***");
    assertThat(result).doesNotContain("eyJabc");
  }

  @Test
  void jwtTokenEhMascarado() {
    // O regex exige pelo menos 10 chars alfanuméricos após 'eyJ' — simula header real de JWT.
    String result =
        SensitiveDataMaskingCustomizer.mask(
            "token eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.defgh1234567890.ghi123");

    assertThat(result).doesNotContain("eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9");
  }

  @Test
  void cpfSemFormatacaoNaoEhMascarado() {
    String result = SensitiveDataMaskingCustomizer.mask("Order id 12345678901");

    assertThat(result).contains("12345678901");
  }

  @Test
  void keyMdcSensivelEhRedacted() {
    String result = SensitiveDataMaskingCustomizer.processValue("cpf", "123.456.789-00");

    assertThat(result).isEqualTo("[REDACTED]");
  }

  @Test
  void keyMdcNaoSensivelNaoEhRedacted() {
    String result = SensitiveDataMaskingCustomizer.processValue("tenant_id", "abc123");

    assertThat(result).isEqualTo("abc123");
  }

  @Test
  void supabaseKeyEhMascarada() {
    String result = SensitiveDataMaskingCustomizer.mask("key=sb_live_abcdefghijklmnopqrstuvwxyz");

    assertThat(result).contains("sb_liv***");
    assertThat(result).doesNotContain("abcdefghijklmnopqrstuvwxyz");
  }

  @Test
  void maskNullRetornaNull() {
    assertThat(SensitiveDataMaskingCustomizer.mask(null)).isNull();
  }

  @Test
  void processValueNullRetornaNull() {
    assertThat(SensitiveDataMaskingCustomizer.processValue("message", null)).isNull();
  }

  @Test
  @SuppressWarnings("unchecked")
  void customizeRegistraValueProcessor() {
    var customizer = new SensitiveDataMaskingCustomizer();
    JsonWriter.Members<ILoggingEvent> members = mock(JsonWriter.Members.class);

    customizer.customize(members);

    verify(members).applyingValueProcessor(any());
  }
}
