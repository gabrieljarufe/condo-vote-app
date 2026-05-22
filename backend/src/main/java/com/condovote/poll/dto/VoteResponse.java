package com.condovote.poll.dto;

import com.condovote.poll.Vote;
import java.time.OffsetDateTime;
import java.util.UUID;

public record VoteResponse(
    UUID id, UUID pollId, UUID apartmentId, UUID optionId, OffsetDateTime votedAt) {

  public static VoteResponse from(Vote v) {
    return new VoteResponse(v.id(), v.pollId(), v.apartmentId(), v.pollOptionId(), v.votedAt());
  }
}
