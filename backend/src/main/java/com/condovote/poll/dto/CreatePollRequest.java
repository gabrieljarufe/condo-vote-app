package com.condovote.poll.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public record CreatePollRequest(
    @NotBlank @Size(max = 255) String title,
    @Size(max = 5000) String description,
    @NotBlank String convocation,
    @NotBlank String quorumMode,
    @NotNull OffsetDateTime scheduledStart,
    @NotNull OffsetDateTime scheduledEnd,
    @NotNull @Size(min = 2, max = 10) List<@NotBlank String> options) {}
