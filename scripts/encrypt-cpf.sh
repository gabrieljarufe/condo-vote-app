#!/usr/bin/env bash
# encrypt-cpf.sh — Cifra um CPF com AES-256-SIV usando a mesma lógica do backend.
#
# Uso:
#   export CPF_ENCRYPTION_KEY=<64 hex chars>
#   ./scripts/encrypt-cpf.sh 12345678901
#
# Saída: ciphertext em hex maiúsculo, pronto para uso em migrations Flyway.
#
# Pré-requisito: o backend deve estar compilado (./mvnw package -DskipTests).
# A CPF_ENCRYPTION_KEY deve ser carregada do cofre (Bitwarden) antes de executar.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: $0 <cpf_somente_digitos>" >&2
  exit 1
fi

if [ -z "${CPF_ENCRYPTION_KEY:-}" ]; then
  echo "Erro: CPF_ENCRYPTION_KEY não definida. Carregue do cofre antes de executar." >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR="$(find "${SCRIPT_DIR}/../backend/target" -name "*.jar" ! -name "*-plain.jar" 2>/dev/null | head -1)"

if [ -z "$JAR" ]; then
  echo "Erro: JAR do backend não encontrado em backend/target/." >&2
  echo "Execute: cd backend && ./mvnw package -DskipTests" >&2
  exit 3
fi

exec java \
  -cp "$JAR" \
  com.condovote.shared.crypto.CpfEncryptorCli \
  "$1"
