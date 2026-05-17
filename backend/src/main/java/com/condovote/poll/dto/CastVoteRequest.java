package com.condovote.poll.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CastVoteRequest(@NotNull UUID apartmentId, @NotNull UUID optionId) {}
