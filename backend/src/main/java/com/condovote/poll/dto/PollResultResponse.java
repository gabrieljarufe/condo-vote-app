package com.condovote.poll.dto;

import com.condovote.poll.PollResult;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PollResultResponse(
    Integer totalVotes,
    UUID winningOptionId,
    Boolean quorumReached,
    String closeTrigger,
    String invalidationReason,
    OffsetDateTime determinedAt,
    String optionsBreakdown) {

  public static PollResultResponse from(PollResult result) {
    return new PollResultResponse(
        result.totalVotesComputed(),
        result.winningOptionId(),
        result.quorumReached(),
        result.closeTrigger(),
        result.invalidationReason(),
        result.computedAt(),
        result.votesPerOption());
  }
}
