-- V1001__bootstrap_pitufos.sql
-- Bootstrap: Condomínio dos Pitufos, síndico: Gabriel Jarufe
-- Autorizado por: jarufe, em 2026-05-11

-- ============================================================
-- 1. Condomínio
-- ============================================================
INSERT INTO condominium (id, name, address)
VALUES (
    '019e1620-fb2a-7ed3-b126-b07a6bbed0c8',
    'Condomínio dos Pitufos',
    'Rua dos Pitufos, 42, Vila Smurf, São Paulo, SP'
);

-- ============================================================
-- 2. Usuário do síndico em app_user
--    id = UUID gerado pelo Supabase Auth (auth.users.id em prod)
--    cpf_encrypted = hex gerado por scripts/encrypt-cpf.sh com a chave de prod
--
--    Bloco idempotente: suporta síndico que já existe em outro condomínio (cross-condo).
--    Casos tratados:
--      a) UUID não existe → INSERT normal
--      b) UUID existe com mesmo email → noop (síndico legítimo de outro condo)
--      c) UUID existe com email diferente → EXCEPTION (operador colou UUID errado)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE id = '4004d1a6-089e-48e2-a107-1c45d9420ed4'::uuid) THEN
    INSERT INTO app_user (id, name, email, cpf_encrypted, consent_accepted_at, consent_policy_version)
    VALUES (
        '4004d1a6-089e-48e2-a107-1c45d9420ed4',
        'Gabriel Jarufe',
        'gabrieljarufe1@gmail.com',
        decode('cf59422bf144312279155a7d9e249f30638ce42f1b38c9eb8e74fd', 'hex'),
        now(),
        'v1'
    );
  ELSIF EXISTS (SELECT 1 FROM app_user WHERE id = '4004d1a6-089e-48e2-a107-1c45d9420ed4'::uuid
                AND email = 'gabrieljarufe1@gmail.com') THEN
    NULL; -- mesmo UUID, mesmo email → noop (síndico cross-condo)
  ELSE
    RAISE EXCEPTION 'UUID % já existe com email diferente — operador colou UUID errado?',
                    '4004d1a6-089e-48e2-a107-1c45d9420ed4';
  END IF;
END $$;

-- ============================================================
-- 3. Vínculo administrador
-- ============================================================
INSERT INTO condominium_admin (id, condominium_id, user_id)
VALUES (
    '019e1620-fb2a-7e25-8cd5-a88ad4aab1da',
    '019e1620-fb2a-7ed3-b126-b07a6bbed0c8',
    '4004d1a6-089e-48e2-a107-1c45d9420ed4'
);

-- ============================================================
-- 4. Auditoria do bootstrap
-- ============================================================
INSERT INTO audit_event (id, condominium_id, actor_user_id, event_type, entity_type, entity_id, payload)
VALUES (
    '019e1620-fb2a-7ca1-8760-148d002fdd5f',
    '019e1620-fb2a-7ed3-b126-b07a6bbed0c8',
    '00000000-0000-0000-0000-000000000001',  -- system user (BOOTSTRAP_MIGRATION)
    'ADMIN_GRANTED',
    'CONDOMINIUM_ADMIN',
    '4004d1a6-089e-48e2-a107-1c45d9420ed4',
    jsonb_build_object(
        'source',    'BOOTSTRAP_MIGRATION',
        'migration', 'V1001__bootstrap_pitufos',
        'operator',  'jarufe'
    )
);
