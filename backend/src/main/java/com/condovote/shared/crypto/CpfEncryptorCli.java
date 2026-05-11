package com.condovote.shared.crypto;

import java.util.HexFormat;
import org.cryptomator.siv.SivMode;

/**
 * CLI standalone para cifrar CPFs sem subir o contexto Spring.
 *
 * <p>Uso:
 *
 * <pre>
 *   export CPF_ENCRYPTION_KEY=&lt;64 hex chars&gt;
 *   java -cp backend/target/condo-vote-backend.jar \
 *        com.condovote.shared.crypto.CpfEncryptorCli 12345678901
 * </pre>
 *
 * <p>A saída é o ciphertext em hex maiúsculo, pronto para uso em migrations Flyway.
 *
 * <p>Nota: esta classe é excluída do JaCoCo (ver pom.xml) pois é ferramenta operacional, não lógica
 * de domínio.
 */
public class CpfEncryptorCli {

  public static void main(String[] args) {
    if (args.length != 1) {
      System.err.println("Uso: CpfEncryptorCli <cpf_somente_digitos>");
      System.exit(1);
    }

    String hexKey = System.getenv("CPF_ENCRYPTION_KEY");
    if (hexKey == null || hexKey.isBlank()) {
      System.err.println("Erro: variável de ambiente CPF_ENCRYPTION_KEY não definida.");
      System.exit(2);
    }

    String cpf = args[0].replaceAll("[^0-9]", "");
    if (cpf.length() != 11) {
      System.err.println("Erro: CPF deve ter 11 dígitos (sem formatação); recebido: " + cpf);
      System.exit(3);
    }

    HexFormat hex = HexFormat.of();
    byte[] raw = hex.parseHex(hexKey);
    if (raw.length != 64) {
      System.err.println(
          "Erro: CPF_ENCRYPTION_KEY deve ter 64 bytes (128 hex chars); recebido: " + raw.length);
      System.exit(4);
    }

    byte[] ctrKey = new byte[32];
    byte[] macKey = new byte[32];
    System.arraycopy(raw, 0, ctrKey, 0, 32);
    System.arraycopy(raw, 32, macKey, 0, 32);

    SivMode siv = new SivMode();
    byte[] ciphertext = siv.encrypt(ctrKey, macKey, cpf.getBytes());
    System.out.println(hex.formatHex(ciphertext).toUpperCase());
  }

  private CpfEncryptorCli() {}
}
