-- Sem RLS: perfil de usuário é cross-tenant (um usuário pode pertencer a vários condomínios)
-- id = auth.users.id do Supabase — copiado pelo service em /register/complete, sem FK física
CREATE TABLE app_user (
    id                      UUID         NOT NULL,
    name                    VARCHAR(255) NOT NULL,
    email                   VARCHAR(320) NOT NULL,
    cpf_encrypted           BYTEA        NOT NULL,
    is_active               BOOLEAN      NOT NULL DEFAULT true,
    consent_accepted_at     TIMESTAMPTZ  NOT NULL,
    consent_policy_version  VARCHAR(20)  NOT NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_app_user PRIMARY KEY (id),
    CONSTRAINT uq_app_user_email         UNIQUE (email),
    CONSTRAINT uq_app_user_cpf_encrypted UNIQUE (cpf_encrypted)
);
