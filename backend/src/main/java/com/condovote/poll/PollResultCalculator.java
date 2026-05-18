package com.condovote.poll;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Função pura que calcula o desfecho de uma votação ao fechar.
 *
 * <p>Não possui dependências injetadas — testável sem mocks.
 *
 * <p>Regras de quórum conforme docs/condo-vote-principles.md §6:
 *
 * <ul>
 *   <li>Primeira Convocação: exige quórum de presença (CEIL(snapshot / 2.0) votos)
 *   <li>Segunda Convocação: nenhum quórum de presença — qualquer número de votos vale
 *   <li>Empate exato: INVALIDATED com reason NO_OPTION_REACHED_THRESHOLD — nenhuma opção atingiu
 *       maioria. É matematicamente impossível duas opções atingirem simultaneamente um limiar >50%,
 *       mas em SIMPLE_MAJORITY com votos pares pode ocorrer empate 50-50 onde nenhuma atinge
 *       floor(total/2)+1; tratado como INVALIDATED.
 * </ul>
 */
@Component
public class PollResultCalculator {

  // Convocações
  public static final String CONVOCATION_FIRST = "FIRST";
  public static final String CONVOCATION_SECOND = "SECOND";

  // Modos de quórum (valores do enum quorum_mode no banco)
  public static final String MODE_SIMPLE_MAJORITY = "SIMPLE_MAJORITY";
  public static final String MODE_ABSOLUTE_MAJORITY = "ABSOLUTE_MAJORITY";
  public static final String MODE_QUALIFIED_2_3 = "QUALIFIED_2_3";
  public static final String MODE_QUALIFIED_3_4 = "QUALIFIED_3_4";

  // Outcomes
  public static final String OUTCOME_CLOSED = "CLOSED";
  public static final String OUTCOME_INVALIDATED = "INVALIDATED";

  // Razões de invalidação (valores do enum poll_invalidation_reason no banco)
  public static final String REASON_PRESENCE_QUORUM_NOT_REACHED = "PRESENCE_QUORUM_NOT_REACHED";
  public static final String REASON_NO_OPTION_REACHED_THRESHOLD = "NO_OPTION_REACHED_THRESHOLD";

  public record CalculationInput(
      String convocation, // "FIRST" | "SECOND"
      String
          quorumMode, // "SIMPLE_MAJORITY" | "ABSOLUTE_MAJORITY" | "QUALIFIED_2_3" | "QUALIFIED_3_4"
      int snapshotSize,
      Map<UUID, Long> votesByOption // optionId -> count; opções com 0 votos podem estar ausentes
      ) {}

  public record OptionTally(UUID optionId, long votes, double percentage) {}

  public record CalculationOutput(
      String outcome, // "CLOSED" | "INVALIDATED"
      UUID winningOptionId, // null se INVALIDATED
      String invalidationReason, // null se CLOSED. Valores: REASON_* constantes acima
      long totalVotes,
      List<OptionTally> breakdown // ordenado por votos DESC, tie-break por optionId
      ) {}

  /**
   * Calcula o desfecho da votação.
   *
   * @throws IllegalArgumentException se convocation ou quorumMode forem valores inválidos
   */
  public CalculationOutput calculate(CalculationInput input) {
    validateInput(input);

    long totalVotes = sumVotes(input.votesByOption());
    List<OptionTally> breakdown = buildBreakdown(input.votesByOption(), totalVotes);

    // 1. Checar quórum de presença (apenas Primeira Convocação)
    if (CONVOCATION_FIRST.equals(input.convocation())) {
      long presenceThreshold = ceilHalf(input.snapshotSize());
      if (totalVotes < presenceThreshold) {
        return invalidated(REASON_PRESENCE_QUORUM_NOT_REACHED, totalVotes, breakdown);
      }
    }

    // 2. Calcular limiar da opção vencedora
    long winThreshold = computeWinThreshold(input.quorumMode(), input.snapshotSize(), totalVotes);

    // 3. Encontrar opção vencedora (única que atinge o limiar)
    UUID winner = findWinner(input.votesByOption(), winThreshold);

    if (winner == null) {
      return invalidated(REASON_NO_OPTION_REACHED_THRESHOLD, totalVotes, breakdown);
    }

    return new CalculationOutput(OUTCOME_CLOSED, winner, null, totalVotes, breakdown);
  }

  // --- helpers privados ---

  private void validateInput(CalculationInput input) {
    if (!CONVOCATION_FIRST.equals(input.convocation())
        && !CONVOCATION_SECOND.equals(input.convocation())) {
      throw new IllegalArgumentException(
          "Convocação inválida: '" + input.convocation() + "'. Valores aceitos: FIRST, SECOND.");
    }
    if (!MODE_SIMPLE_MAJORITY.equals(input.quorumMode())
        && !MODE_ABSOLUTE_MAJORITY.equals(input.quorumMode())
        && !MODE_QUALIFIED_2_3.equals(input.quorumMode())
        && !MODE_QUALIFIED_3_4.equals(input.quorumMode())) {
      throw new IllegalArgumentException(
          "Modo de quórum inválido: '"
              + input.quorumMode()
              + "'. Valores aceitos: SIMPLE_MAJORITY, ABSOLUTE_MAJORITY, QUALIFIED_2_3,"
              + " QUALIFIED_3_4.");
    }
  }

  private long sumVotes(Map<UUID, Long> votesByOption) {
    return votesByOption.values().stream().mapToLong(Long::longValue).sum();
  }

  /** Constrói o breakdown ordenado por votos DESC; tie-break por optionId (UUID natural order). */
  private List<OptionTally> buildBreakdown(Map<UUID, Long> votesByOption, long totalVotes) {
    List<OptionTally> list = new ArrayList<>();
    for (Map.Entry<UUID, Long> entry : votesByOption.entrySet()) {
      double pct = totalVotes > 0 ? round2((double) entry.getValue() / totalVotes * 100.0) : 0.0;
      list.add(new OptionTally(entry.getKey(), entry.getValue(), pct));
    }
    list.sort(
        Comparator.comparingLong(OptionTally::votes)
            .reversed()
            .thenComparing(OptionTally::optionId));
    return list;
  }

  /**
   * Computa o limiar mínimo de votos para uma opção vencer.
   *
   * <ul>
   *   <li>SIMPLE_MAJORITY: floor(totalVotes / 2) + 1
   *   <li>ABSOLUTE_MAJORITY: floor(snapshot / 2) + 1
   *   <li>QUALIFIED_2_3: ceil(snapshot * 2 / 3)
   *   <li>QUALIFIED_3_4: ceil(snapshot * 3 / 4)
   * </ul>
   */
  private long computeWinThreshold(String quorumMode, int snapshotSize, long totalVotes) {
    return switch (quorumMode) {
      case MODE_SIMPLE_MAJORITY -> (totalVotes / 2) + 1;
      case MODE_ABSOLUTE_MAJORITY -> (snapshotSize / 2) + 1;
      case MODE_QUALIFIED_2_3 -> ceilDiv(snapshotSize * 2L, 3);
      case MODE_QUALIFIED_3_4 -> ceilDiv(snapshotSize * 3L, 4);
      default ->
          // nunca alcançado — validateInput já garante
          throw new IllegalStateException("quorumMode inesperado: " + quorumMode);
    };
  }

  /**
   * Retorna o optionId vencedor, ou null se nenhuma opção atingir o limiar (ou se houver empate).
   *
   * <p>Empate: se duas ou mais opções atingem o mesmo limiar, nenhuma é declarada vencedora —
   * retorna null → INVALIDATED NO_OPTION_REACHED_THRESHOLD. Conforme spec §6: "empate exato é um
   * caso particular de INVALIDATED".
   */
  private UUID findWinner(Map<UUID, Long> votesByOption, long threshold) {
    UUID winner = null;
    boolean tie = false;

    for (Map.Entry<UUID, Long> entry : votesByOption.entrySet()) {
      if (entry.getValue() >= threshold) {
        if (winner == null) {
          winner = entry.getKey();
        } else {
          // duas opções atingiram o limiar — empate
          tie = true;
          break;
        }
      }
    }

    return tie ? null : winner;
  }

  private CalculationOutput invalidated(
      String reason, long totalVotes, List<OptionTally> breakdown) {
    return new CalculationOutput(OUTCOME_INVALIDATED, null, reason, totalVotes, breakdown);
  }

  /** CEIL(n / 2.0) — arredondamento para cima do quórum de presença. */
  private long ceilHalf(int n) {
    return (n + 1) / 2;
  }

  /** Divisão inteira com arredondamento para cima: ceil(a / b). */
  private long ceilDiv(long a, long b) {
    return (a + b - 1) / b;
  }

  private double round2(double value) {
    return Math.round(value * 100.0) / 100.0;
  }
}
