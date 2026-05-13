package com.condovote.shared.notification;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("email_notification")
public record EmailNotification(
    @Id UUID id,
    UUID userId,
    String type, // string-mapping do enum: "INVITATION", "POLL_SCHEDULED", etc.
    String payload, // JSON serializado (String) — converter no Service
    String status, // "PENDING" | "SENT" | "FAILED" | "BOUNCED"
    int attempts,
    String lastError,
    Instant scheduledFor,
    Instant sentAt,
    Instant createdAt) {}
