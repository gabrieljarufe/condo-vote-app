package com.condovote.shared.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.condovote.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class CpfEncryptorIT extends AbstractIntegrationTest {

  @Autowired CpfEncryptor encryptor;

  @Test
  void beanEhInjetadoCorretamente() {
    assertThat(encryptor).isNotNull();
  }

  @Test
  void roundtripViaSpringContext() {
    String cpf = "12345678901";
    assertThat(encryptor.decrypt(encryptor.encrypt(cpf))).isEqualTo(cpf);
  }

  @Test
  void deterministicoViaSpringContext() {
    String cpf = "98765432100";
    assertThat(encryptor.encrypt(cpf)).isEqualTo(encryptor.encrypt(cpf));
  }

  @Test
  void cpfComLetrasLancaExcecaoViaSpringContext() {
    assertThatThrownBy(() -> encryptor.encrypt("abc12345678"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void stripPontuacaoViaSpringContext() {
    assertThat(encryptor.encrypt("123.456.789-01")).isEqualTo(encryptor.encrypt("12345678901"));
  }
}
