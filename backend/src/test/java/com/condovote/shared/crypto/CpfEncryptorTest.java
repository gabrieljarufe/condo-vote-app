package com.condovote.shared.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CpfEncryptorTest {

  /** Chave de 32 bytes (64 hex chars) para uso exclusivo em testes. */
  private static final String TEST_KEY =
      "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

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
    assertThat(encryptor.encrypt("11111111111")).isNotEqualTo(encryptor.encrypt("22222222222"));
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
        .hasMessageContaining("32 bytes");
  }
}
