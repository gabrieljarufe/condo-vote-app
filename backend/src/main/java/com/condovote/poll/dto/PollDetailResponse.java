package com.condovote.poll.dto;

import java.util.List;

public record PollDetailResponse(
    PollResponse poll, List<PollOptionResponse> options, PollResultResponse result) {}
