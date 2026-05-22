package com.condovote.poll.dto;

import java.util.List;

public record MyBallotsResponse(
    List<MyBallotResponse> ballots,
    List<ExcludedApartmentResponse> excludedApartments,
    Long totalVotesSoFar,
    long eligibleCount) {}
