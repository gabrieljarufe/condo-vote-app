package com.condovote.shared.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CpfEncryptorTest {

  /** Chave de 64 bytes (128 hex chars) para uso exclusivo em testes. */
  private static final String TEST_KEY =
      "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
          + "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40";

  private final CpfEncryptor encryptor = new CpfEncryptor(TEST_KEY);

  @Test
  void deveCifrarEDecifrarCorretamente() {
    String cpf = "12345678901";
    String ciphertext = encryptor.encrypt(cpf);
    assertThat(encryptor.decrypt(ciphertext)).isEqualTo(cpf);
  }

  @Test
  void deveSer_deterministico() {
    String cpf = "98765432100";
    assertThat(encryptor.encrypt(cpf)).isEqualTo(encryptor.encrypt(cpf));
  }

  @Test
  void cpfsDiferentesDevemProuzirCiphertextsDiferentes() {
    assertThat(encryptor.encrypt("12345678901")).isNotEqualTo(encryptor.encrypt("98765432100"));
  }

  @Test
  void ciphertextDeveSerHexMaiusculo() {
    String ciphertext = encryptor.encrypt("12345678901");
    assertThat(ciphertext).matches("[0-9A-F]+");
  }

  @Test
  void deveLancarExcecaoParaCpfNulo() {
    assertThatThrownBy(() -> encryptor.encrypt(null)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void deveLancarExcecaoParaCiphertextCorrompido() {
    assertThatThrownBy(() -> encryptor.decrypt("DEADBEEF")).isInstanceOf(Exception.class);
  }

  @Test
  void deveLancarExcecaoParaChaveInvalida() {
    assertThatThrownBy(() -> new CpfEncryptor("0000"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("64 bytes");
  }

  @Test
  void deveStripPontuacaoAntesDeEncriptar() {
    assertThat(encryptor.encrypt("123.456.789-01")).isEqualTo(encryptor.encrypt("12345678901"));
  }

  @Test
  void deveLancarExcecaoParaCpfComMenosDe11Digitos() {
    assertThatThrownBy(() -> encryptor.encrypt("123")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void deveLancarExcecaoParaCpfComLetras() {
    assertThatThrownBy(() -> encryptor.encrypt("abc12345678"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void deveLancarExcecaoParaCpfComDigitosIguais() {
    assertThatThrownBy(() -> encryptor.encrypt("11111111111"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
