# Runbook: Backup e Restore — Supabase Free Tier

**Frequência de backup:** semanal (manual, enquanto no free tier).

**Upgrade para PITR automático:** ao migrar para **Supabase Pro** (~$25/mês), o Point-in-Time
Recovery (PITR) é habilitado automaticamente com retenção de 7 dias. Até lá, seguir este runbook.

---

## Backup Manual (semanal)

### Via Supabase Dashboard

1. Acesse **Supabase Dashboard** → projeto de produção.
2. Vá em **Database → Backups**.
3. Clique em **"Create backup"**.
4. Aguarde a conclusão (geralmente < 2 min para databases pequenas).
5. Confirme que o backup aparece na lista com status `Completed`.

### Via CLI (alternativa)

```bash
# Requer Supabase CLI autenticado: supabase login
supabase db dump --project-ref <PROJECT_REF> --file backup-$(date +%Y%m%d).sql

# Para incluir dados (além do schema):
supabase db dump --project-ref <PROJECT_REF> --data-only --file data-$(date +%Y%m%d).sql
```

O arquivo gerado é um SQL dump PostgreSQL padrão.

---

## Log de Backups

| Data | Método | Status | Observações |
|------|--------|--------|-------------|
| (preencher na primeira execução) | Dashboard | | |

---

## Restore (em caso de incidente)

### Restore via Dashboard (Supabase Free)

O Supabase Free Tier mantém **backups diários automáticos por 7 dias** (com possibilidade de
restauração manual via ticket de suporte). Para backups manuais:

1. Acesse **Database → Backups** → selecione o backup desejado.
2. Clique em **"Restore"**.
3. Confirme a operação — o banco será sobrescrito com o estado do backup.
4. Após restore, reinicie o backend no Coolify para garantir conexão limpa.

### Restore via SQL dump (backup CLI)

```bash
# 1. Conecte via Session Pooler (IPv4)
PGPASSWORD=<senha> psql \
  -h aws-1-<region>.pooler.supabase.com \
  -p 5432 \
  -U postgres.<project-ref> \
  -d postgres \
  -f backup-YYYYMMDD.sql
```

> **Atenção:** restaurar um dump completo sobrescreve todos os dados. Sempre confirme com o usuário
> antes de executar. Considere restaurar em um banco de staging primeiro.

---

## Verificação pós-restore

Após qualquer restore:

1. Verificar contagem de linhas nas tabelas críticas:
   ```sql
   SELECT
     (SELECT count(*) FROM condominium) AS condominiums,
     (SELECT count(*) FROM app_user)    AS users,
     (SELECT count(*) FROM audit_event) AS audit_events;
   ```
2. Confirmar que o síndico consegue logar e ver o condomínio.
3. Conferir logs Coolify — Flyway deve reportar "Schema `public` is up to date" (nenhuma
   migration pendente após restore de um banco já migrado).

---

## Migração para Supabase Pro (PITR)

Ao atingir qualquer um destes critérios, migrar para Pro:

- Primeiro condomínio em produção com usuários reais
- Qualquer dado pessoal (CPF, e-mail) em prod
- SLA exigido pelo cliente

Após upgrade: verificar em **Database → Backups** que o PITR está ativo e configurado com
retenção desejada (mínimo 7 dias recomendado).
