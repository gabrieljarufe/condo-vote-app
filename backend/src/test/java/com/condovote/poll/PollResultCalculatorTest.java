package com.condovote.poll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.condovote.poll.PollResultCalculator.CalculationInput;
import com.condovote.poll.PollResultCalculator.CalculationOutput;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PollResultCalculatorTest {

  private static final UUID A = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
  private static final UUID B = UUID.fromString("00000000-0000-0000-0000-0000000000bb");
  private static final UUID C = UUID.fromString("00000000-0000-0000-0000-0000000000cc");

  private final PollResultCalculator calculator = new PollResultCalculator();

  private static Map<UUID, Long> votes(Object... pairs) {
    Map<UUID, Long> m = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) {
      m.put((UUID) pairs[i], ((Number) pairs[i + 1]).longValue());
    }
    return m;
  }

  // --- Convocação FIRST + SIMPLE_MAJORITY ---

  @Test
  @DisplayName("FIRST SIMPLE_MAJORITY 10 elegíveis 6 votos com vencedor: CLOSED")
  void firstSimple_quorumOkAndWinner_closed() {
    CalculationOutput out =
        calculator.calculate(
            new CalculationInput("FIRST", "SIMPLE_MAJORITY", 10, votes(A, 4L, B, 2L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
    assertThat(out.invalidationReason()).isNull();
    assertThat(out.totalVotes()).isEqualTo(6);
  }

  @Test
  @DisplayName("FIRST SIMPLE_MAJORITY 10 elegíveis só 4 votos: INVALIDATED por quórum de presença")
  void firstSimple_belowPresenceQuorum_invalidated() {
    CalculationOutput out =
        calculator.calculate(
            new CalculationInput("FIRST", "SIMPLE_MAJORITY", 10, votes(A, 2L, B, 2L)));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("PRESENCE_QUORUM_NOT_REACHED");
    assertThat(out.winningOptionId()).isNull();
  }

  @Test
  @DisplayName(
      "FIRST SIMPLE_MAJORITY 11 elegíveis 6 votos empatados 3x3: INVALIDATED por threshold")
  void firstSimple_quorumOkButTie_invalidatedThreshold() {
    CalculationOutput out =
        calculator.calculate(
            new CalculationInput("FIRST", "SIMPLE_MAJORITY", 11, votes(A, 3L, B, 3L)));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("NO_OPTION_REACHED_THRESHOLD");
  }

  @Test
  @DisplayName("FIRST SIMPLE_MAJORITY 1 elegível 1 voto: CLOSED")
  void firstSimple_singleEligible_closed() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "SIMPLE_MAJORITY", 1, votes(A, 1L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
  }

  // --- Convocação SECOND + SIMPLE_MAJORITY (sem quórum de presença) ---

  @Test
  @DisplayName("SECOND SIMPLE_MAJORITY 10 elegíveis 1 voto: CLOSED (não há quórum de presença)")
  void secondSimple_singleVote_closed() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("SECOND", "SIMPLE_MAJORITY", 10, votes(A, 1L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
  }

  @Test
  @DisplayName("SECOND SIMPLE_MAJORITY sem votos: INVALIDATED por threshold")
  void secondSimple_noVotes_invalidatedThreshold() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("SECOND", "SIMPLE_MAJORITY", 10, votes()));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("NO_OPTION_REACHED_THRESHOLD");
    assertThat(out.totalVotes()).isZero();
  }

  @Test
  @DisplayName("SECOND SIMPLE_MAJORITY empate exato 2x2: INVALIDATED")
  void secondSimple_exactTie_invalidated() {
    CalculationOutput out =
        calculator.calculate(
            new CalculationInput("SECOND", "SIMPLE_MAJORITY", 4, votes(A, 2L, B, 2L)));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("NO_OPTION_REACHED_THRESHOLD");
  }

  // --- ABSOLUTE_MAJORITY (denominador = snapshot) ---

  @Test
  @DisplayName("FIRST ABSOLUTE_MAJORITY 10 elegíveis A=6: CLOSED")
  void firstAbsolute_reachesThreshold_closed() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "ABSOLUTE_MAJORITY", 10, votes(A, 6L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
  }

  @Test
  @DisplayName("FIRST ABSOLUTE_MAJORITY 10 elegíveis A=5: INVALIDATED (5 < floor(10/2)+1=6)")
  void firstAbsolute_belowThreshold_invalidated() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "ABSOLUTE_MAJORITY", 10, votes(A, 5L)));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("NO_OPTION_REACHED_THRESHOLD");
  }

  @Test
  @DisplayName("SECOND ABSOLUTE_MAJORITY 10 elegíveis A=10: CLOSED")
  void secondAbsolute_unanimous_closed() {
    CalculationOutput out =
        calculator.calculate(
            new CalculationInput("SECOND", "ABSOLUTE_MAJORITY", 10, votes(A, 10L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
  }

  // --- QUALIFIED_2_3 ---

  @Test
  @DisplayName("FIRST QUALIFIED_2_3 9 elegíveis A=6 (ceil(9*2/3)=6): CLOSED")
  void firstQualified23_reaches_closed() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "QUALIFIED_2_3", 9, votes(A, 6L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
  }

  @Test
  @DisplayName("FIRST QUALIFIED_2_3 9 elegíveis A=5: INVALIDATED")
  void firstQualified23_below_invalidated() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "QUALIFIED_2_3", 9, votes(A, 5L)));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("NO_OPTION_REACHED_THRESHOLD");
  }

  // --- QUALIFIED_3_4 ---

  @Test
  @DisplayName("FIRST QUALIFIED_3_4 8 elegíveis A=6 (ceil(8*3/4)=6): CLOSED")
  void firstQualified34_reaches_closed() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "QUALIFIED_3_4", 8, votes(A, 6L)));

    assertThat(out.outcome()).isEqualTo("CLOSED");
    assertThat(out.winningOptionId()).isEqualTo(A);
  }

  @Test
  @DisplayName("FIRST QUALIFIED_3_4 8 elegíveis A=5: INVALIDATED")
  void firstQualified34_below_invalidated() {
    CalculationOutput out =
        calculator.calculate(new CalculationInput("FIRST", "QUALIFIED_3_4", 8, votes(A, 5L)));

    assertThat(out.outcome()).isEqualTo("INVALIDATED");
    assertThat(out.invalidationReason()).isEqualTo("NO_OPTION_REACHED_THRESHOLD");
  }

  // --- Estrutura do output ---

  @Test
  @DisplayName("Breakdown vem ordenado por votos DESC e percentuais corretos")
  void breakdown_orderedDescAndPercentagesCorrect() {
    CalculationOutput out =
        calculator.calculate(
            new CalculationInput("SECOND", "SIMPLE_MAJORITY", 10, votes(A, 2L, B, 5L, C, 3L)));

    assertThat(out.totalVotes()).isEqualTo(10);
    assertThat(out.breakdown()).extracting(t -> t.optionId()).containsExactly(B, C, A);
    assertThat(out.breakdown().get(0).votes()).isEqualTo(5);
    assertThat(out.breakdown().get(0).percentage()).isEqualTo(50.0);
    assertThat(out.breakdown().get(1).percentage()).isEqualTo(30.0);
    assertThat(out.breakdown().get(2).percentage()).isEqualTo(20.0);
  }

  // --- Validações de input ---

  @Test
  @DisplayName("Convocation inválida lança IllegalArgumentException")
  void invalidConvocation_throws() {
    assertThatThrownBy(
            () ->
                calculator.calculate(
                    new CalculationInput("THIRD", "SIMPLE_MAJORITY", 10, votes(A, 6L))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Convocação inválida");
  }

  @Test
  @DisplayName("Quorum mode inválido lança IllegalArgumentException")
  void invalidQuorumMode_throws() {
    assertThatThrownBy(
            () ->
                calculator.calculate(new CalculationInput("FIRST", "UNANIMOUS", 10, votes(A, 10L))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Modo de quórum inválido");
  }
}
