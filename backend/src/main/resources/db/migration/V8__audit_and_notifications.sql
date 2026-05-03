-- audit_event -------------------------------------------------------------
CREATE TABLE audit_event (
    id              UUID             NOT NULL,
    condominium_id  UUID             NOT NULL,
    actor_user_id   UUID             NOT NULL,
    event_type      audit_event_type NOT NULL,
    entity_type     VARCHAR(50)      NOT NULL,
    entity_id       UUID             NOT NULL,
    payload         JSONB            NOT NULL,
    occurred_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT pk_audit_event PRIMARY KEY (id),
    CONSTRAINT fk_audit_event_condominium FOREIGN KEY (condominium_id) REFERENCES condominium (id)
);

CREATE INDEX idx_audit_event_condominium_id ON audit_event (condominium_id, occurred_at DESC);
CREATE INDEX idx_audit_event_entity         ON audit_event (entity_type, entity_id);
CREATE INDEX idx_audit_event_event_type     ON audit_event (event_type);

-- email_notification -------------------------------------------------------
-- transactional outbox: enfileirado na mesma transação da operação de negócio
CREATE TABLE email_notification (
    id             UUID         NOT NULL,
    user_id        UUID         NOT NULL,
    type           email_type   NOT NULL,
    payload        JSONB        NOT NULL,
    status         email_status NOT NULL DEFAULT 'PENDING',
    attempts       INT          NOT NULL DEFAULT 0,
    last_error     TEXT         NULL,
    scheduled_for  TIMESTAMPTZ  NOT NULL,
    sent_at        TIMESTAMPTZ  NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_email_notification PRIMARY KEY (id)
);

-- partial index FIFO-friendly: cobre WHERE status='PENDING' AND scheduled_for <= now()
-- e ORDER BY created_at do EmailSenderJob em uma única index walk (Issue #3)
CREATE INDEX idx_email_pending_fifo
    ON email_notification (scheduled_for, created_at)
    WHERE status = 'PENDING';

CREATE INDEX idx_email_notification_user_id ON email_notification (user_id, created_at DESC);
