-- Sem RLS: tabela cross-tenant acessada por superadmin
CREATE TABLE condominium (
    id          UUID         NOT NULL,
    name        VARCHAR(255) NOT NULL,
    address     VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_condominium PRIMARY KEY (id)
);
