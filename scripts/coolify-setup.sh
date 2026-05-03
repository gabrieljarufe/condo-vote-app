#!/usr/bin/env bash
# =============================================================================
# coolify-setup.sh — Recria a application condo-vote-backend no Coolify via API
#
# Pré-requisitos:
#   - Coolify instalado e acessível em https://coolify.condovote.com.br
#   - COOLIFY_API_TOKEN exportado ou definido abaixo
#   - GitHub App já criado no Coolify (requer UI — ver rebuild-vm.md passo 9)
#   - jq instalado (brew install jq)
#
# Uso:
#   export COOLIFY_API_TOKEN=<seu_token>
#   export DATABASE_URL=<valor>
#   export SUPABASE_URL=<valor>
#   ... (demais variáveis)
#   bash scripts/coolify-setup.sh
# =============================================================================

set -euo pipefail

COOLIFY_BASE_URL="https://coolify.condovote.com.br/api/v1"

# ---------------------------------------------------------------------------
# Validação
# ---------------------------------------------------------------------------

required_vars=(
  COOLIFY_API_TOKEN
  DATABASE_URL
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  REDIS_URL
  RESEND_API_KEY
  RESEND_FROM_ADDRESS
  CPF_ENCRYPTION_KEY
  CORS_ALLOWED_ORIGINS
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Variável obrigatória não definida: $var"
    exit 1
  fi
done

AUTH_HEADER="Authorization: Bearer $COOLIFY_API_TOKEN"

# ---------------------------------------------------------------------------
# 1 — Buscar Server UUID
# ---------------------------------------------------------------------------

echo "→ Buscando server UUID..."
SERVER_UUID=$(curl -sf "$COOLIFY_BASE_URL/servers" \
  -H "$AUTH_HEADER" | jq -r '.[0].uuid')

if [[ -z "$SERVER_UUID" || "$SERVER_UUID" == "null" ]]; then
  echo "❌ Nenhum server encontrado. Certifique-se que o Coolify está configurado."
  exit 1
fi
echo "  Server UUID: $SERVER_UUID"

# ---------------------------------------------------------------------------
# 2 — Buscar ou criar Project
# ---------------------------------------------------------------------------

echo "→ Buscando project UUID..."
PROJECT_UUID=$(curl -sf "$COOLIFY_BASE_URL/projects" \
  -H "$AUTH_HEADER" | jq -r '.[] | select(.name == "condo-vote") | .uuid')

if [[ -z "$PROJECT_UUID" || "$PROJECT_UUID" == "null" ]]; then
  echo "  Project 'condo-vote' não encontrado. Criando..."
  PROJECT_UUID=$(curl -sf -X POST "$COOLIFY_BASE_URL/projects" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d '{"name": "condo-vote", "description": "Condo Vote App"}' | jq -r '.uuid')
  echo "  Project criado: $PROJECT_UUID"
else
  echo "  Project UUID: $PROJECT_UUID"
fi

# ---------------------------------------------------------------------------
# 3 — Buscar GitHub App UUID
# ---------------------------------------------------------------------------

echo "→ Buscando GitHub App UUID..."
GITHUB_APP_UUID=$(curl -sf "$COOLIFY_BASE_URL/security/keys" \
  -H "$AUTH_HEADER" | jq -r '.[0].uuid' 2>/dev/null || echo "")

# GitHub Apps são listados de forma diferente — instrução manual se não encontrar
if [[ -z "$GITHUB_APP_UUID" || "$GITHUB_APP_UUID" == "null" ]]; then
  echo ""
  echo "⚠️  GitHub App UUID não encontrado via API."
  echo "   Acesse https://coolify.condovote.com.br → Sources → GitHub App 'condo-vote'"
  echo "   e copie o UUID da URL ou settings."
  echo ""
  read -rp "   Cole o GitHub App UUID aqui: " GITHUB_APP_UUID
fi
echo "  GitHub App UUID: $GITHUB_APP_UUID"

# ---------------------------------------------------------------------------
# 4 — Verificar se application já existe
# ---------------------------------------------------------------------------

echo "→ Verificando se application já existe..."
EXISTING_APP=$(curl -sf "$COOLIFY_BASE_URL/applications" \
  -H "$AUTH_HEADER" | jq -r '.[] | select(.name == "condo-vote-backend") | .uuid' 2>/dev/null || echo "")

if [[ -n "$EXISTING_APP" && "$EXISTING_APP" != "null" ]]; then
  echo "  Application já existe (UUID: $EXISTING_APP). Pulando criação."
  APP_UUID="$EXISTING_APP"
else
  # -------------------------------------------------------------------------
  # 5 — Criar application
  # -------------------------------------------------------------------------
  echo "→ Criando application condo-vote-backend..."
  APP_UUID=$(curl -sf -X POST "$COOLIFY_BASE_URL/applications/private-github-app" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{
      \"project_uuid\": \"$PROJECT_UUID\",
      \"server_uuid\": \"$SERVER_UUID\",
      \"environment_name\": \"production\",
      \"github_app_uuid\": \"$GITHUB_APP_UUID\",
      \"git_repository\": \"https://github.com/jarufe/condo-vote-app\",
      \"git_branch\": \"main\",
      \"build_pack\": \"dockerfile\",
      \"dockerfile_location\": \"/backend/Dockerfile\",
      \"base_directory\": \"/backend\",
      \"ports_exposes\": \"8080\",
      \"name\": \"condo-vote-backend\",
      \"domains\": \"https://api.condovote.com.br\",
      \"is_auto_deploy_enabled\": true,
      \"health_check_enabled\": true,
      \"health_check_path\": \"/actuator/health\",
      \"health_check_interval\": 30
    }" | jq -r '.uuid')

  if [[ -z "$APP_UUID" || "$APP_UUID" == "null" ]]; then
    echo "❌ Falha ao criar application."
    exit 1
  fi
  echo "  Application criada: $APP_UUID"
fi

# ---------------------------------------------------------------------------
# 6 — Injetar variáveis de ambiente em bulk
# ---------------------------------------------------------------------------

echo "→ Injetando variáveis de ambiente..."
curl -sf -X PATCH "$COOLIFY_BASE_URL/applications/$APP_UUID/envs/bulk" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": [
      {\"key\": \"DATABASE_URL\",            \"value\": \"$DATABASE_URL\",            \"is_shown_once\": true},
      {\"key\": \"SUPABASE_URL\",             \"value\": \"$SUPABASE_URL\"},
      {\"key\": \"SUPABASE_ANON_KEY\",        \"value\": \"$SUPABASE_ANON_KEY\"},
      {\"key\": \"SUPABASE_SERVICE_ROLE_KEY\", \"value\": \"$SUPABASE_SERVICE_ROLE_KEY\", \"is_shown_once\": true},
      {\"key\": \"REDIS_URL\",                \"value\": \"$REDIS_URL\",                \"is_shown_once\": true},
      {\"key\": \"RESEND_API_KEY\",           \"value\": \"$RESEND_API_KEY\",           \"is_shown_once\": true},
      {\"key\": \"RESEND_FROM_ADDRESS\",      \"value\": \"$RESEND_FROM_ADDRESS\"},
      {\"key\": \"CPF_ENCRYPTION_KEY\",       \"value\": \"$CPF_ENCRYPTION_KEY\",       \"is_shown_once\": true},
      {\"key\": \"CORS_ALLOWED_ORIGINS\",     \"value\": \"$CORS_ALLOWED_ORIGINS\"},
      {\"key\": \"SPRING_PROFILES_ACTIVE\",   \"value\": \"prod\"},
      {\"key\": \"SERVER_PORT\",              \"value\": \"8080\"}
    ]
  }" > /dev/null

echo "  Variáveis injetadas."

# ---------------------------------------------------------------------------
# 7 — Validar
# ---------------------------------------------------------------------------

echo ""
echo "✅ Setup concluído!"
echo ""
echo "   Application UUID : $APP_UUID"
echo "   Domínio           : https://api.condovote.com.br"
echo ""
echo "   Próximos passos:"
echo "   1. Aguardar Dockerfile existir (Fase 3) antes de triggerar deploy"
echo "   2. Ou disparar deploy manualmente:"
echo "      curl -X GET \"$COOLIFY_BASE_URL/deploy?uuid=$APP_UUID\" \\"
echo "        -H \"$AUTH_HEADER\""
