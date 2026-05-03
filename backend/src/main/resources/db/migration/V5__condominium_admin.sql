CREATE TABLE condominium_admin (
    id                  UUID        NOT NULL,
    condominium_id      UUID        NOT NULL,
    user_id             UUID        NOT NULL,
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ NULL,
    revoked_by_user_id  UUID        NULL,

    CONSTRAINT pk_condominium_admin PRIMARY KEY (id),
    CONSTRAINT fk_condominium_admin_condominium FOREIGN KEY (condominium_id) REFERENCES condominium (id),

    -- quem revogou é obrigatório quando revogado
    CONSTRAINT chk_condominium_admin_revoke
        CHECK (revoked_at IS NULL OR revoked_by_user_id IS NOT NULL)
);

-- um vínculo ativo por usuário por condomínio
CREATE UNIQUE INDEX uq_condominium_admin_active
    ON condominium_admin (condominium_id, user_id)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_condominium_admin_condominium_id ON condominium_admin (condominium_id);
CREATE INDEX idx_condominium_admin_user_id         ON condominium_admin (user_id);
