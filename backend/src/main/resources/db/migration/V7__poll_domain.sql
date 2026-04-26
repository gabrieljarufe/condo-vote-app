-- poll --------------------------------------------------------------------
CREATE TABLE poll (
    id                    UUID             NOT NULL,
    condominium_id        UUID             NOT NULL,
    previous_poll_id      UUID             NULL,
    title                 VARCHAR(255)     NOT NULL,
    description           TEXT             NULL,
    convocation           convocation_type NOT NULL,
    quorum_mode           quorum_mode      NOT NULL,
    status                poll_status      NOT NULL DEFAULT 'DRAFT',
    scheduled_start       TIMESTAMPTZ      NULL,
    scheduled_end         TIMESTAMPTZ      NULL,
    opened_at             TIMESTAMPTZ      NULL,
    opened_by_user_id     UUID             NULL,
    -- denormalização: tamanho do snapshot gerado na transição SCHEDULED→OPEN (Issue #2)
    eligible_count        INT              NULL,
    closed_at             TIMESTAMPTZ      NULL,
    cancelled_at          TIMESTAMPTZ      NULL,
    cancelled_by_user_id  UUID             NULL,
    cancellation_reason   TEXT             NULL,
    created_by_user_id    UUID             NOT NULL,
    created_at            TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT pk_poll PRIMARY KEY (id),
    CONSTRAINT fk_poll_condominium  FOREIGN KEY (condominium_id)   REFERENCES condominium (id),
    CONSTRAINT fk_poll_previous     FOREIGN KEY (previous_poll_id) REFERENCES poll (id),

    -- necessário para composite FKs em vote e poll_eligible_snapshot
    CONSTRAINT uq_poll_id_condominium_id UNIQUE (id, condominium_id),

    -- datas obrigatórias a partir de SCHEDULED
    CONSTRAINT chk_poll_dates
        CHECK (status = 'DRAFT' OR (
            scheduled_start IS NOT NULL AND
            scheduled_end   IS NOT NULL AND
            scheduled_end   > scheduled_start
        )),
    -- cancelamento exige autor, data e motivo
    CONSTRAINT chk_poll_cancelled
        CHECK (status != 'CANCELLED' OR (
            cancelled_at          IS NOT NULL AND
            cancelled_by_user_id  IS NOT NULL AND
            cancellation_reason   IS NOT NULL
        )),
    -- abertura exige opened_at
    CONSTRAINT chk_poll_opened
        CHECK (status NOT IN ('OPEN', 'CLOSED', 'INVALIDATED') OR opened_at IS NOT NULL),
    -- fechamento exige closed_at
    CONSTRAINT chk_poll_closed
        CHECK (status NOT IN ('CLOSED', 'INVALIDATED') OR closed_at IS NOT NULL),
    -- snapshot materializado exige eligible_count
    CONSTRAINT chk_poll_eligible_count
        CHECK (status NOT IN ('OPEN', 'CLOSED', 'INVALIDATED') OR eligible_count IS NOT NULL)
);

CREATE INDEX idx_poll_condominium_id ON poll (condominium_id);
CREATE INDEX idx_poll_status         ON poll (condominium_id, status);

-- partial indexes para jobs cross-tenant (Issue #1 da análise de escala 2026-04-25)
CREATE INDEX idx_poll_due_to_open  ON poll (scheduled_start) WHERE status = 'SCHEDULED';
CREATE INDEX idx_poll_due_to_close ON poll (scheduled_end)   WHERE status = 'OPEN';

-- poll_option --------------------------------------------------------------
CREATE TABLE poll_option (
    id             UUID         NOT NULL,
    poll_id        UUID         NOT NULL,
    label          VARCHAR(500) NOT NULL,
    display_order  INT          NOT NULL,

    CONSTRAINT pk_poll_option   PRIMARY KEY (id),
    CONSTRAINT fk_poll_option_poll FOREIGN KEY (poll_id) REFERENCES poll (id),
    CONSTRAINT uq_poll_option_order UNIQUE (poll_id, display_order)
);

CREATE INDEX idx_poll_option_poll_id ON poll_option (poll_id);

-- poll_eligible_snapshot ---------------------------------------------------
CREATE TABLE poll_eligible_snapshot (
    id                      UUID        NOT NULL,
    condominium_id          UUID        NOT NULL,
    poll_id                 UUID        NOT NULL,
    apartment_id            UUID        NOT NULL,
    eligible_voter_user_id  UUID        NOT NULL,
    snapshotted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_poll_eligible_snapshot PRIMARY KEY (id),
    CONSTRAINT fk_poll_eligible_snapshot_condominium FOREIGN KEY (condominium_id) REFERENCES condominium (id),
    CONSTRAINT fk_poll_eligible_snapshot_poll        FOREIGN KEY (poll_id)        REFERENCES poll (id),
    CONSTRAINT fk_poll_eligible_snapshot_apartment   FOREIGN KEY (apartment_id)   REFERENCES apartment (id),

    CONSTRAINT uq_poll_eligible_snapshot UNIQUE (poll_id, apartment_id)
);

CREATE INDEX idx_poll_eligible_snapshot_poll_id         ON poll_eligible_snapshot (poll_id);
CREATE INDEX idx_poll_eligible_snapshot_condominium_id  ON poll_eligible_snapshot (condominium_id);

-- vote ---------------------------------------------------------------------
CREATE TABLE vote (
    id              UUID        NOT NULL,
    condominium_id  UUID        NOT NULL,
    poll_id         UUID        NOT NULL,
    poll_option_id  UUID        NOT NULL,
    apartment_id    UUID        NOT NULL,
    voter_user_id   UUID        NOT NULL,
    voted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_vote PRIMARY KEY (id),
    CONSTRAINT fk_vote_condominium  FOREIGN KEY (condominium_id) REFERENCES condominium (id),
    CONSTRAINT fk_vote_poll         FOREIGN KEY (poll_id)        REFERENCES poll (id),
    CONSTRAINT fk_vote_poll_option  FOREIGN KEY (poll_option_id) REFERENCES poll_option (id),
    CONSTRAINT fk_vote_apartment    FOREIGN KEY (apartment_id)   REFERENCES apartment (id),

    CONSTRAINT uq_vote_one_per_apartment UNIQUE (poll_id, apartment_id)
);

CREATE INDEX idx_vote_condominium_id  ON vote (condominium_id);
CREATE INDEX idx_vote_poll_id         ON vote (poll_id);
CREATE INDEX idx_vote_voter_user_id   ON vote (voter_user_id);

-- poll_result --------------------------------------------------------------
CREATE TABLE poll_result (
    poll_id                UUID                    NOT NULL,
    condominium_id         UUID                    NOT NULL,
    quorum_denominator     INT                     NOT NULL,
    total_votes_computed   INT                     NOT NULL,
    winning_option_id      UUID                    NULL,
    quorum_reached         BOOLEAN                 NOT NULL,
    invalidation_reason    poll_invalidation_reason NULL,
    close_trigger          poll_close_trigger       NOT NULL,
    votes_per_option       JSONB                   NOT NULL,
    computed_at            TIMESTAMPTZ             NOT NULL DEFAULT now(),

    CONSTRAINT pk_poll_result PRIMARY KEY (poll_id),
    CONSTRAINT fk_poll_result_poll          FOREIGN KEY (poll_id)          REFERENCES poll (id),
    CONSTRAINT fk_poll_result_condominium   FOREIGN KEY (condominium_id)   REFERENCES condominium (id),
    CONSTRAINT fk_poll_result_winning       FOREIGN KEY (winning_option_id) REFERENCES poll_option (id),

    -- exatamente um dos dois: winner ou invalidation_reason
    CONSTRAINT chk_poll_result_outcome
        CHECK (
            (winning_option_id IS NOT NULL AND invalidation_reason IS NULL) OR
            (winning_option_id IS NULL     AND invalidation_reason IS NOT NULL)
        )
);

CREATE INDEX idx_poll_result_condominium_id ON poll_result (condominium_id);
