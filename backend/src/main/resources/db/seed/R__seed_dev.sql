-- Seed de desenvolvimento local — executado pelo Flyway somente quando
-- spring.flyway.locations inclui classpath:db/seed (application-local.yaml).
-- NUNCA incluir em application.yaml (prod) ou application-prod.yaml.
--
-- UUIDs v7 gerados offline em 2026-04-28 via python3 -c "import uuid; print(uuid.uuid7())"
-- O UUID do síndico (faa86997-...) é v4 gerado pelo Supabase Auth — única exceção ao padrão v7.
-- O mesmo UUID deve existir em auth.users do Supabase local (ver infra/supabase/supabase/seed.sql).

-- Limpa dados seed anteriores (R__ é repeatable — roda quando o conteúdo muda)
DELETE FROM condominium_admin  WHERE condominium_id IN ('019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', '019de5e8-a735-757a-a1bc-39af03edee05');
DELETE FROM apartment_resident WHERE condominium_id IN ('019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', '019de5e8-a735-757a-a1bc-39af03edee05');
DELETE FROM apartment          WHERE condominium_id IN ('019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', '019de5e8-a735-757a-a1bc-39af03edee05');
DELETE FROM app_user           WHERE id = 'faa86997-f34c-42c4-98b4-2dac8a40fa34';
DELETE FROM condominium        WHERE id IN ('019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', '019de5e8-a735-757a-a1bc-39af03edee05');

-- Condomínio de teste
INSERT INTO condominium (id, name, address, created_at) VALUES (
    '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e',
    'Condomínio Teste Local',
    'Rua Seed Dev, 42 — São Paulo/SP',
    now()
);

-- Síndico seed (UUID v4 — vem do Supabase Auth local, ver seed.sql do CLI)
-- Credenciais de login: sindico@local.dev / password123
INSERT INTO app_user (
    id, name, email, cpf_encrypted,
    is_active, consent_accepted_at, consent_policy_version, created_at
) VALUES (
    'faa86997-f34c-42c4-98b4-2dac8a40fa34',
    'Síndico Dev',
    'sindico@local.dev',
    '\x00',  -- placeholder: CPF não é verificado em dev; valor dummy para satisfazer NOT NULL
    true,
    now(),
    'v1',
    now()
);

-- Síndico como admin do condomínio
INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (
    '019dd4fc-c1e0-7576-bf07-c1397a6d0bda',
    '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e',
    'faa86997-f34c-42c4-98b4-2dac8a40fa34',
    now()
);

-- Apartamentos de teste (bloco A)
INSERT INTO apartment (id, condominium_id, block, unit_number, is_delinquent, created_at) VALUES
    ('019dd4f8-57fa-77b1-ace2-c9f78d6fc50c', '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', 'A', '101', false, now()),
    ('019dd4f8-57fa-77b1-ace2-c9f8fb30cb4a', '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', 'A', '102', false, now()),
    ('019dd4f8-57fa-77b1-ace2-c9f99d4168bd', '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', 'A', '103', false, now());

-- ──────────────────────────────────────────────
-- Condomínio 2 — para testar isolamento RLS
-- ──────────────────────────────────────────────

-- UUIDs v7 gerados em 2026-05-01 via python3 -c "import uuid; print(uuid.uuid7())"

INSERT INTO condominium (id, name, address, created_at) VALUES (
    '019de5e8-a735-757a-a1bc-39af03edee05',
    'Condomínio Teste 2',
    'Av. Seed Dev, 100 — Rio de Janeiro/RJ',
    now()
);

-- Mesmo síndico seed como admin do segundo condomínio
INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (
    '019de5e8-a735-757a-a1bc-39b003612508',
    '019de5e8-a735-757a-a1bc-39af03edee05',
    'faa86997-f34c-42c4-98b4-2dac8a40fa34',
    now()
);

-- Apartamentos de teste (bloco B)
INSERT INTO apartment (id, condominium_id, block, unit_number, is_delinquent, created_at) VALUES
    ('019de5e8-a735-757a-a1bc-39b124b95a6a', '019de5e8-a735-757a-a1bc-39af03edee05', 'B', '201', false, now()),
    ('019de5e8-a735-757a-a1bc-39b24ba6eb15', '019de5e8-a735-757a-a1bc-39af03edee05', 'B', '202', false, now()),
    ('019de5e8-a735-757a-a1bc-39b305dda261', '019de5e8-a735-757a-a1bc-39af03edee05', 'B', '203', false, now());
