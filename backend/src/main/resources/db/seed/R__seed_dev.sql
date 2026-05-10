-- Seed de desenvolvimento local — executado pelo Flyway somente quando
-- spring.flyway.locations inclui classpath:db/seed (application-local.yaml).
-- NUNCA incluir em application.yaml (prod) ou application-prod.yaml.
--
-- Baseado no template V1001__bootstrap_TEMPLATE.sql.example.
-- Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente (R__ = repeatable).
--
-- UUIDs v7 gerados offline em 2026-04-28 via python3 -c "import uuid; print(uuid.uuid7())"
-- O UUID do síndico (faa86997-...) é v4 gerado pelo Supabase Auth — única exceção ao padrão v7.
-- O mesmo UUID deve existir em auth.users do Supabase local (ver infra/supabase/supabase/seed.sql).

-- ============================================================
-- 1. Condomínios
-- ============================================================
INSERT INTO condominium (id, name, address, created_at) VALUES (
    '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e',
    'Condomínio Teste Local',
    'Rua Seed Dev, 42 — São Paulo/SP',
    now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO condominium (id, name, address, created_at) VALUES (
    '019de5e8-a735-757a-a1bc-39af03edee05',
    'Condomínio Teste 2',
    'Av. Seed Dev, 100 — Rio de Janeiro/RJ',
    now()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Usuário do síndico em app_user
--    id = UUID do Supabase Auth local (ver infra/supabase/supabase/seed.sql)
--    cpf_encrypted = '\x00' placeholder — CPF não é verificado em dev
--
--    Bloco idempotente: suporta síndico que já existe em outro condomínio (cross-condo).
--    Casos tratados:
--      a) UUID não existe → INSERT normal
--      b) UUID existe com mesmo email → noop (síndico legítimo de outro condo)
--      c) UUID existe com email diferente → EXCEPTION (operador colou UUID errado)
--
--    Credenciais de login: sindico@local.dev / password123
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = 'faa86997-f34c-42c4-98b4-2dac8a40fa34'::uuid) THEN
    INSERT INTO app_user (id, name, email, cpf_encrypted, is_active, consent_accepted_at, consent_policy_version, created_at)
    VALUES (
        'faa86997-f34c-42c4-98b4-2dac8a40fa34',
        'Síndico Dev',
        'sindico@local.dev',
        '\x00',
        true,
        now(),
        'v1',
        now()
    );
  ELSIF EXISTS (SELECT 1 FROM app_user WHERE id = 'faa86997-f34c-42c4-98b4-2dac8a40fa34'::uuid
                AND email = 'sindico@local.dev') THEN
    NULL; -- mesmo UUID, mesmo email → noop (síndico cross-condo)
  ELSE
    RAISE EXCEPTION 'UUID faa86997-f34c-42c4-98b4-2dac8a40fa34 já existe com email diferente — seed.sql inconsistente?';
  END IF;
END $$;

-- ============================================================
-- 3. Vínculos administrador
-- ============================================================
INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (
    '019dd4fc-c1e0-7576-bf07-c1397a6d0bda',
    '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e',
    'faa86997-f34c-42c4-98b4-2dac8a40fa34',
    now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO condominium_admin (id, condominium_id, user_id, granted_at) VALUES (
    '019de5e8-a735-757a-a1bc-39b003612508',
    '019de5e8-a735-757a-a1bc-39af03edee05',
    'faa86997-f34c-42c4-98b4-2dac8a40fa34',
    now()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Apartamentos
-- ============================================================

-- Condomínio 1 — bloco A
INSERT INTO apartment (id, condominium_id, block, unit_number, is_delinquent, created_at) VALUES
    ('019dd4f8-57fa-77b1-ace2-c9f78d6fc50c', '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', 'A', '101', false, now()),
    ('019dd4f8-57fa-77b1-ace2-c9f8fb30cb4a', '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', 'A', '102', false, now()),
    ('019dd4f8-57fa-77b1-ace2-c9f99d4168bd', '019dd4f8-57fa-77b1-ace2-c9f6a3d9811e', 'A', '103', false, now())
ON CONFLICT (id) DO NOTHING;

-- Condomínio 2 — bloco B
INSERT INTO apartment (id, condominium_id, block, unit_number, is_delinquent, created_at) VALUES
    ('019de5e8-a735-757a-a1bc-39b124b95a6a', '019de5e8-a735-757a-a1bc-39af03edee05', 'B', '201', false, now()),
    ('019de5e8-a735-757a-a1bc-39b24ba6eb15', '019de5e8-a735-757a-a1bc-39af03edee05', 'B', '202', false, now()),
    ('019de5e8-a735-757a-a1bc-39b305dda261', '019de5e8-a735-757a-a1bc-39af03edee05', 'B', '203', false, now())
ON CONFLICT (id) DO NOTHING;
