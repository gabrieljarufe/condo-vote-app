-- apartment ----------------------------------------------------------------
CREATE TABLE apartment (
    id                      UUID         NOT NULL,
    condominium_id          UUID         NOT NULL,
    block                   VARCHAR(50)  NULL,
    unit_number             VARCHAR(20)  NOT NULL,
    eligible_voter_user_id  UUID         NULL,
    is_delinquent           BOOLEAN      NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_apartment PRIMARY KEY (id),
    CONSTRAINT fk_apartment_condominium FOREIGN KEY (condominium_id) REFERENCES condominium (id),

    -- necessário para composite FKs em tabelas filhas (defesa contra mismatch de tenant)
    CONSTRAINT uq_apartment_id_condominium_id UNIQUE (id, condominium_id),

    -- unicidade funcional: COALESCE trata NULL como string vazia para fins de comparação
    CONSTRAINT uq_apartment_unit UNIQUE (condominium_id, COALESCE(block, ''), unit_number)
);

CREATE INDEX idx_apartment_condominium_id ON apartment (condominium_id);

-- apartment_resident -------------------------------------------------------
CREATE TABLE apartment_resident (
    id                UUID               NOT NULL,
    condominium_id    UUID               NOT NULL,
    apartment_id      UUID               NOT NULL,
    user_id           UUID               NOT NULL,
    role              resident_role      NOT NULL,
    joined_at         TIMESTAMPTZ        NOT NULL DEFAULT now(),
    ended_at          TIMESTAMPTZ        NULL,
    ended_by_user_id  UUID               NULL,
    end_reason        resident_end_reason NULL,

    CONSTRAINT pk_apartment_resident PRIMARY KEY (id),
    CONSTRAINT fk_apartment_resident_condominium FOREIGN KEY (condominium_id) REFERENCES condominium (id),
    CONSTRAINT fk_apartment_resident_apartment   FOREIGN KEY (apartment_id)   REFERENCES apartment (id),

    -- coerência de encerramento: ended_at preenchido exige autor e motivo
    CONSTRAINT chk_apartment_resident_end
        CHECK (ended_at IS NULL OR (ended_by_user_id IS NOT NULL AND end_reason IS NOT NULL))
);

-- máx 1 owner ativo por apartamento
CREATE UNIQUE INDEX uq_apartment_resident_one_active_owner
    ON apartment_resident (apartment_id)
    WHERE role = 'OWNER' AND ended_at IS NULL;

CREATE INDEX idx_apartment_resident_condominium_id ON apartment_resident (condominium_id);
CREATE INDEX idx_apartment_resident_user_id         ON apartment_resident (user_id);
