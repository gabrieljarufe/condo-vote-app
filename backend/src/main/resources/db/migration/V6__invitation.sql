-- token de aceite NÃO persiste aqui — vive em Redis (TTL 24h, chave invitation:token:{token})
CREATE TABLE invitation (
    id                  UUID               NOT NULL,
    condominium_id      UUID               NOT NULL,
    apartment_id        UUID               NOT NULL,
    email               VARCHAR(320)       NOT NULL,
    cpf_encrypted       BYTEA              NOT NULL,
    role                resident_role      NOT NULL,
    status              invitation_status  NOT NULL DEFAULT 'PENDING',
    expires_at          TIMESTAMPTZ        NOT NULL,
    accepted_at         TIMESTAMPTZ        NULL,
    revoked_at          TIMESTAMPTZ        NULL,
    revoked_by_user_id  UUID               NULL,
    created_by_user_id  UUID               NOT NULL,
    created_at          TIMESTAMPTZ        NOT NULL DEFAULT now(),

    CONSTRAINT pk_invitation PRIMARY KEY (id),
    CONSTRAINT fk_invitation_condominium FOREIGN KEY (condominium_id) REFERENCES condominium (id),
    CONSTRAINT fk_invitation_apartment   FOREIGN KEY (apartment_id)   REFERENCES apartment (id),

    CONSTRAINT chk_invitation_accepted CHECK (status != 'ACCEPTED' OR accepted_at IS NOT NULL),
    CONSTRAINT chk_invitation_revoked  CHECK (status != 'REVOKED'  OR revoked_at  IS NOT NULL)
);

-- impede duplicata de convite pendente para mesma unidade/email/papel
CREATE UNIQUE INDEX uq_invitation_pending
    ON invitation (condominium_id, apartment_id, email, role)
    WHERE status = 'PENDING';

CREATE INDEX idx_invitation_condominium_id ON invitation (condominium_id);
