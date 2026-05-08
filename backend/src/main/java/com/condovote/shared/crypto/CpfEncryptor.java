package com.condovote.shared.crypto;

import java.util.HexFormat;
import javax.crypto.IllegalBlockSizeException;
import org.cryptomator.siv.SivMode;
import org.cryptomator.siv.UnauthenticCiphertextException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Criptografa e decriptografa CPFs usando AES-256-SIV (determinístico + autenticado).
 *
 * <p>Determinismo é requisito da UNIQUE(cpf_encrypted) no banco — o mesmo CPF sempre produz o mesmo
 * ciphertext. AES-SIV também garante autenticidade: qualquer alteração no ciphertext é detectada na
 * decriptografia.
 *
 * <p>A chave é configurada via variável de ambiente {@code CPF_ENCRYPTION_KEY} como hex de 64
 * caracteres (32 bytes = 256 bits).
 */
@Component
public class CpfEncryptor {

  private static final SivMode SIV = new SivMode();
  private static final HexFormat HEX = HexFormat.of();

  private final byte[] ctrKey;
  private final byte[] macKey;

  public CpfEncryptor(@Value("${app.cpf.encryption-key}") String hexKey) {
    byte[] raw = HEX.parseHex(hexKey);
    if (raw.length != 32) {
      throw new IllegalArgumentException(
          "CPF_ENCRYPTION_KEY deve ter 32 bytes (64 hex chars); recebido: " + raw.length);
    }
    // SIV usa duas subchaves de 16 bytes: [0..15] → CTR, [16..31] → MAC
    this.ctrKey = new byte[16];
    this.macKey = new byte[16];
    System.arraycopy(raw, 0, this.ctrKey, 0, 16);
    System.arraycopy(raw, 16, this.macKey, 0, 16);
  }

  /**
   * Cifra o CPF (somente dígitos) e retorna ciphertext em hex maiúsculo.
   *
   * @param cpf CPF em claro (somente dígitos, sem formatação)
   * @return ciphertext em hex
   */
  public String encrypt(String cpf) {
    if (cpf == null || cpf.isBlank()) {
      throw new IllegalArgumentException("CPF não pode ser nulo ou vazio");
    }
    String digits = cpf.replaceAll("[.\\-]", "");
    if (!digits.matches("\\d{11}")) {
      throw new IllegalArgumentException("CPF deve conter 11 dígitos numéricos; recebido: " + cpf);
    }
    if (digits.chars().distinct().count() == 1) {
      throw new IllegalArgumentException("CPF inválido: todos os dígitos são iguais");
    }
    byte[] ciphertext = SIV.encrypt(ctrKey, macKey, digits.getBytes());
    return HEX.formatHex(ciphertext).toUpperCase();
  }

  /**
   * Decifra o ciphertext (hex) e retorna o CPF em claro.
   *
   * @param hexCiphertext ciphertext em hex (produzido por {@link #encrypt})
   * @return CPF em claro (somente dígitos)
   * @throws IllegalArgumentException se o ciphertext estiver corrompido ou a chave for incorreta
   */
  public String decrypt(String hexCiphertext) {
    if (hexCiphertext == null || hexCiphertext.isBlank()) {
      throw new IllegalArgumentException("Ciphertext não pode ser nulo ou vazio");
    }
    try {
      byte[] ciphertext = HEX.parseHex(hexCiphertext.toLowerCase());
      byte[] plain = SIV.decrypt(ctrKey, macKey, ciphertext);
      return new String(plain);
    } catch (UnauthenticCiphertextException | IllegalBlockSizeException e) {
      throw new IllegalArgumentException("Ciphertext inválido ou corrompido", e);
    }
  }
}
