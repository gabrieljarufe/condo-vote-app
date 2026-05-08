# Runbook: Verificação Mensal — Data API Supabase Desabilitada

**Frequência:** mensal (ex: primeiro dia do mês).

**Quem executa:** operador (dev com acesso ao Supabase Dashboard de prod).

**Por que é crítico:**

A **Data API** (PostgREST) está desabilitada em prod desde a Fase 1. Reabilitá-la sem as devidas
proteções expõe dados sensíveis porque:

- `app_user`, `condominium`, `email_notification` e `poll_option` **não têm RLS**.
- Os grants `SELECT`, `INSERT`, etc. para os roles `anon` e `authenticated` foram herdados do
  Supabase e não foram explicitamente revogados.
- A `anon key` está presente no bundle Angular (necessária para o fluxo Auth) — qualquer pessoa
  com a chave poderia fazer queries diretas via PostgREST se a Data API estivesse ativa.

Ver decisão completa em:
- `docs/analysis/2026-04-27-supabase-linter-rls-warnings.md`
- `docs/architecture.md §8`

---

## Procedimento

1. Acesse **Supabase Dashboard** → projeto de produção.

2. Vá em **Settings → API**.

3. Confirme que a seção **"Data API"** (ou "PostgREST") está **desabilitada**.

   - Deve mostrar: `Data API is disabled` ou toggle em posição OFF.
   - Se estiver habilitada: **desabilite imediatamente** e investigue como foi ativada.

4. Registre a verificação no arquivo de log abaixo.

---

## Log de verificações

| Data | Operador | Status |
|------|----------|--------|
| (preencher na primeira verificação) | | Data API desabilitada ✅ |

---

## O que fazer se estiver habilitada

1. **Desabilite imediatamente** no Dashboard → Settings → API.
2. Verifique os logs de auditoria do Supabase para identificar quem reabilitou.
3. Verifique se houve queries não autorizadas via PostgREST nos logs.
4. Abra issue de segurança no repositório com timeline e ação tomada.

---

## Automação futura (v2)

Na Supabase Pro, será possível configurar alertas via webhook quando configurações críticas mudam.
Por enquanto, a verificação é manual.
