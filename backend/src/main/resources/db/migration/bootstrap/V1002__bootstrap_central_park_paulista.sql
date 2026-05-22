-- V1002__bootstrap_central_park_paulista.sql
-- Bootstrap: Condomínio Central Park Paulista, síndico: Gabriel Jarufe (mesmo síndico do V1001)
-- Sem apartamentos e sem moradores — apenas o síndico vinculado.
-- Autorizado por: jarufe, em 2026-05-22

-- ============================================================
-- 1. Condomínio
-- ============================================================
INSERT INTO condominium (id, name, address)
VALUES (
    '019e50ff-0af1-7a4d-9ac1-aaad8077cd80',
    'Condomínio Central Park Paulista',
    'Av. Paulista, 1000, Bela Vista, São Paulo, SP'
);

-- ============================================================
-- 2. Usuário do síndico em app_user
--    Mesmo síndico do V1001 (gabrieljarufe1@gmail.com).
--    Bloco idempotente: V1001 já o inseriu, então deve cair no ramo "mesmo UUID, mesmo email → noop".
--    Mantido aqui para preservar o padrão e suportar execução isolada do bootstrap.
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
    '019e50ff-0af1-7829-a8b1-d4b4cde4781a',
    '019e50ff-0af1-7a4d-9ac1-aaad8077cd80',
    '4004d1a6-089e-48e2-a107-1c45d9420ed4'
);

-- ============================================================
-- 4. Auditoria do bootstrap
-- ============================================================
INSERT INTO audit_event (id, condominium_id, actor_user_id, event_type, entity_type, entity_id, payload)
VALUES (
    '019e50ff-0af1-75dc-8910-5a191621f3ae',
    '019e50ff-0af1-7a4d-9ac1-aaad8077cd80',
    '00000000-0000-0000-0000-000000000001',  -- system user (BOOTSTRAP_MIGRATION)
    'ADMIN_GRANTED',
    'CONDOMINIUM_ADMIN',
    '4004d1a6-089e-48e2-a107-1c45d9420ed4',
    jsonb_build_object(
        'source',    'BOOTSTRAP_MIGRATION',
        'migration', 'V1002__bootstrap_central_park_paulista',
        'operator',  'jarufe'
    )
);
