# Runbook: Bootstrap de Condomínio

**Quando usar:** onboarding do primeiro síndico de um novo condomínio.

**Quem executa:** operador (dev com acesso ao Bitwarden + GitHub).

**Pré-requisitos:**
- Backend compilado: `cd backend && ./mvnw package -DskipTests`
- `CPF_ENCRYPTION_KEY` carregada do Bitwarden para a env local
- Acesso de escrita no repositório

---

## Passo 1 — Criar usuário no Supabase Auth

No **Supabase Dashboard** do projeto de produção:

```
Authentication → Users → Invite user
  Email: <email do síndico>
```

Anote o **UUID** gerado (coluna `id` em `auth.users`). Esse UUID será o `app_user.id`.

> Alternativa CLI: `supabase auth invite <email> --project-ref <ref>`

---

## Passo 2 — Gerar ciphertext do CPF

```bash
# Carregue a chave do cofre (Bitwarden → "CPF_ENCRYPTION_KEY prod")
export CPF_ENCRYPTION_KEY=<128 hex chars>  # openssl rand -hex 64

# Cifre o CPF do síndico (somente dígitos)
./scripts/encrypt-cpf.sh <CPF_SEM_FORMATACAO>
```

Saída: ciphertext em hex maiúsculo, ex.: `A3F2B1...`

Salve o ciphertext. **Não comite a chave — apenas o ciphertext.**

---

## Passo 3 — Gerar UUIDs v7 offline

Necessário gerar 3 UUIDs novos (para `condominium.id`, `condominium_admin.id`, `audit_event.id`):

```bash
# Python (uuid6 >= 2022.11)
python3 -c "import uuid6; [print(uuid6.uuid7()) for _ in range(3)]"

# Alternativa Java (compilado):
# Usar a classe UuidV7.java do projeto ou qualquer gerador UUID v7 online.
```

---

## Passo 4 — Criar o arquivo de migration

Copie o template:

```bash
cp backend/src/main/resources/db/migration/bootstrap/V1001__bootstrap_TEMPLATE.sql.example \
   backend/src/main/resources/db/migration/bootstrap/V1001__bootstrap_<condo_slug>.sql
```

Edite o arquivo preenchendo todos os placeholders:

| Placeholder | Valor |
|-------------|-------|
| `<UUID_V7_CONDOMINIUM>` | UUID v7 gerado no Passo 3 |
| `<Nome do Condomínio>` | Nome completo do condomínio |
| `<Endereço completo...>` | Endereço do condomínio |
| `<UUID_SUPABASE_AUTH_SINDICO>` | UUID do Passo 1 |
| `<Nome Completo do Síndico>` | Nome completo |
| `<email@sindico.com>` | E-mail cadastrado no Auth |
| `<HEX_CPF_CIPHERTEXT>` | Saída do Passo 2 |
| `<UUID_V7_ADMIN_LINK>` | Segundo UUID v7 do Passo 3 |
| `<UUID_V7_AUDIT_EVENT>` | Terceiro UUID v7 do Passo 3 |
| `<condo_slug>` | Slug identificador (ex: `edificio_solar`) |
| `<nome_do_operador>` | Seu nome ou handle no GitHub |

> **Atenção:** o `cpf_encrypted` usa `decode('<HEX>', 'hex')` para converter hex em BYTEA.
> Use o hex em **letras minúsculas** dentro do `decode()`.

> **Nota (síndico em múltiplos condomínios):** Se o síndico já foi bootstrapado em outro condomínio com o mesmo `auth.users.id`, o bloco `DO $$` detecta o UUID e pula o INSERT em `app_user` sem erro. Se o UUID coincidir com e-mail diferente, o bootstrap falha com mensagem clara — sinaliza que o operador colou o UUID errado.

---

## Passo 5 — Validar localmente

```bash
# Testa a migration em Testcontainer (banco limpo)
cd backend && ./mvnw verify -Dtest=BootstrapTemplateIT -Dit.test=BootstrapTemplateIT
```

A migration deve aplicar sem erro e os testes devem passar.

---

## Passo 6 — Abrir PR

```bash
git checkout -b feature/bootstrap-<condo-slug>
git add backend/src/main/resources/db/migration/bootstrap/V1001__bootstrap_<condo_slug>.sql
git commit -m "feat(bootstrap): onboarding <Nome do Condomínio> — migration V1001"
# Abrir PR: feature/bootstrap-<condo-slug> → develop
```

O CI roda o `./mvnw verify` (inclui Flyway no Testcontainer). Aguardar aprovação.

**Checklist de review do PR:**

- [ ] UUID do síndico confere com `auth.users` em prod?
- [ ] CPF ciphertext gerado com a chave de prod (não de dev)?
- [ ] Nome e endereço do condomínio corretos?
- [ ] Nenhuma credencial em claro no diff?

---

## Passo 7 — Merge e deploy

1. Merge `feature/bootstrap-<condo-slug>` → `develop`
2. Criar PR `develop → main` (ou aguardar o PR automático do `auto-pr.yml`)
3. Merge em `main` → Coolify redeploy automático → Flyway aplica `V1001` em prod
4. Verificar no Coolify: logs de startup devem conter `Successfully applied 1 migration`

---

## Passo 8 — Comunicar ao síndico

Envie por canal seguro (Signal/WhatsApp/e-mail criptografado):

- URL do frontend: `https://app.condovote.com.br`
- E-mail cadastrado
- Instrução para redefinir a senha (fluxo "Esqueci minha senha" via Supabase Auth)

---

## Rollback (se necessário)

Flyway **não suporta rollback automático** de migrations aplicadas em prod. Se houver erro:

1. Identifique o problema (verificar logs Coolify)
2. Crie uma migration `V1002__fix_<descricao>.sql` que desfaz as inserções incorretas
3. Siga o mesmo fluxo de PR

> Nunca edite ou delete um arquivo de migration já aplicado em prod — Flyway rejeita por checksum.

---

## Verificação final

Após o deploy, confirme que o síndico consegue:

1. Fazer login em `https://app.condovote.com.br`
2. Ver o condomínio no seletor de `HomeComponent`
3. Chamar `GET /api/me/condominiums` com o token Bearer retornando o condomínio
