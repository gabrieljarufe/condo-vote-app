package com.condovote.poll;

import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("poll_option")
public record PollOption(@Id UUID id, UUID pollId, String label, Integer displayOrder) {}
