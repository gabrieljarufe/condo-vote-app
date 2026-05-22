package com.condovote.poll.dto;

import com.condovote.poll.PollOption;
import java.util.UUID;

public record PollOptionResponse(UUID id, String label, Integer displayOrder) {

  public static PollOptionResponse from(PollOption option) {
    return new PollOptionResponse(option.id(), option.label(), option.displayOrder());
  }
}
