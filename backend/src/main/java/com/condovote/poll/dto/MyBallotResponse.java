package com.condovote.poll.dto;

import java.util.UUID;

public record MyBallotResponse(
    UUID apartmentId, String apartmentLabel, boolean alreadyVoted, UUID votedOptionId) {}
