package com.condovote.shared.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

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
}
