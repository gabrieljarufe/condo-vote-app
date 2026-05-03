# Bruno API Collection

Collection do Bruno para validar endpoints do backend manualmente.

Abrir no Bruno Desktop: **File → Open Collection** → selecionar esta pasta.

## Setup inicial

```bash
# Criar environment local a partir do template
cp environments/environment.bru.example environments/local.bru

# Obter a supabase_anon_key local e preencher no local.bru
cd ../infra/supabase && supabase status | grep "anon key"
```

## Fluxo de uso

1. Selecionar ambiente `local` ou `prod` no canto superior direito
2. Executar `auth / Get Access Token` — script salva o token em `access_token` automaticamente
3. Executar qualquer endpoint autenticado (o token é injetado via `{{access_token}}`)

## Estrutura

A estrutura de pastas espelha os módulos do backend:

```
api-collection/
├── auth/        ← obter/refresh de token
├── health/      ← /actuator/health
├── me/          ← /api/me/*
└── environments/
    ├── environment.bru.example
    ├── local.bru        (gitignored — anon key local)
    └── prod.bru         (gitignored — anon key prod)
```

## Convenção obrigatória

**Toda nova rota adicionada ao backend requer um arquivo `.bru` correspondente**
nesta pasta, no módulo correto. PR não deve mergear sem o `.bru` da rota nova.

Exemplo: rota `POST /api/poll` → `api-collection/poll/create-poll.bru`.
