# Runbook — Operações Coolify via SSH

Todos os comandos assumem que as variáveis do `.env` raiz do projeto estão carregadas:

```bash
set -a && source .env && set +a
```

---

## Pré-requisitos

1. **Tailscale** ativo no Mac — sem ele o SSH não alcança a VM
2. **Chave SSH** em `$VM_SSH_KEY` (Bitwarden → `condo-vote-oracle-ssh-private-key`)
   ```bash
   chmod 600 $VM_SSH_KEY
   ```

---

## Conectar na VM

```bash
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE
```

Para executar um comando remoto sem abrir sessão interativa:

```bash
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE "sudo docker ps"
```

---

## Listar containers Coolify

```bash
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "sudo docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

Containers esperados:

| Container | Função |
|-----------|--------|
| `coolify` | API + dashboard Laravel |
| `coolify-db` | PostgreSQL — armazena toda config do Coolify |
| `coolify-redis` | Cache |
| `coolify-proxy` | Traefik |
| `coolify-sentinel` | Health monitor |
| `<uuid>-*` | Instância da aplicação deployada |

---

## API Coolify (via SSH — token válido)

Quando o `COOLIFY_API_TOKEN` estiver válido, todos os comandos abaixo rodam de dentro da VM (onde o Coolify ouve em `localhost:8000`):

```bash
# Listar aplicações
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "curl -s $COOLIFY_BASE_URL/api/v1/applications \
   -H 'Authorization: Bearer $COOLIFY_API_TOKEN'"

# Listar env vars da aplicação backend
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "curl -s $COOLIFY_BASE_URL/api/v1/applications/$COOLIFY_APP_UUID/envs \
   -H 'Authorization: Bearer $COOLIFY_API_TOKEN'"
```

> Se retornar `Unauthenticated`, o token expirou — gere um novo em
> **Coolify dashboard → Keys & Tokens → API Tokens** e atualize `COOLIFY_API_TOKEN` no `.env`.

---

## Banco de dados do Coolify (fallback sem token)

Quando a API não está disponível, use `docker exec` diretamente no `coolify-db`.

### Consultar env vars de uma aplicação

```bash
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "sudo docker exec coolify-db psql -U coolify -c \
   \"SELECT id, key, is_preview FROM environment_variables WHERE application_uuid = '$COOLIFY_APP_UUID';\""
```

### Atualizar uma env var

```bash
# Substitua <KEY> e <VALOR> conforme necessário
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "sudo docker exec coolify-db psql -U coolify -c \
   \"UPDATE environment_variables SET value = '<VALOR>' \
     WHERE key = '<KEY>' AND application_uuid = '$COOLIFY_APP_UUID' \
     RETURNING id, key, is_preview;\""
```

> `is_preview = f` → production · `is_preview = t` → preview
>
> O UPDATE sem `WHERE is_preview` afeta os dois registros simultaneamente — útil quando o valor é igual em ambos os ambientes.

### Verificar valor atual (com dado sensível visível)

```bash
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "sudo docker exec coolify-db psql -U coolify -c \
   \"SELECT id, key, value, is_preview FROM environment_variables WHERE key = '<KEY>';\""
```

---

## Redeploy após alterar env vars

Env vars alteradas direto no banco **não** são aplicadas automaticamente — é preciso triggar redeploy:

```bash
# Via API (token válido)
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "curl -s -X GET '$COOLIFY_BASE_URL/api/v1/deploy?uuid=$COOLIFY_APP_UUID' \
   -H 'Authorization: Bearer $COOLIFY_API_TOKEN'"

# Via dashboard: Coolify → aplicação → Deploy
```

---

## Logs do container da aplicação

```bash
ssh -i $VM_SSH_KEY $VM_SSH_USER@$VM_IP_TAILSCALE \
  "sudo docker logs \$(sudo docker ps --filter name=$COOLIFY_APP_UUID --format '{{.Names}}') --tail 100 -f"
```
