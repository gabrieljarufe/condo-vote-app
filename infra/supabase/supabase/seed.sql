-- Seed do Supabase CLI — executado automaticamente após `supabase start` e `supabase db reset`.
-- Cria o usuário síndico seed em auth.users para que o login local funcione.
--
-- UUID faa86997-f34c-42c4-98b4-2dac8a40fa34 é v4 gerado pelo Supabase Auth (padrão atual).
-- O mesmo UUID está hardcoded em backend/src/main/resources/db/seed/R__seed_dev.sql (app_user).
-- Credenciais: sindico@local.dev / password123

INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
) VALUES (
    'faa86997-f34c-42c4-98b4-2dac8a40fa34',
    '00000000-0000-0000-0000-000000000000',
    'sindico@local.dev',
    crypt('password123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false
)
ON CONFLICT (id) DO NOTHING;
