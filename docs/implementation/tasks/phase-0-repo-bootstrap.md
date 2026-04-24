# Fase 0 — Preparação do Repositório

**Objetivo:** sair de "só docs" para "projeto com estrutura de pastas e branch protection".

**Pré-requisitos:** nenhum.

---

## T0.1 — Estrutura de diretórios e gitignores
- [x] Criar diretórios: `backend/`, `frontend/`, `infra/`, `.github/workflows/`
- [x] Criar `backend/.gitignore` (Maven/Spring: `target/`, `.idea/`, `*.iml`, `.env`)
- [x] Criar `frontend/.gitignore` (Angular: `node_modules/`, `dist/`, `.angular/`, `.env`)
- [x] Criar `.editorconfig` na raiz (UTF-8, LF, 4 espaços Java, 2 espaços TS/YAML)
- [x] Criar `.env.example` na raiz com placeholders das variáveis que vão existir
- [x] Garantir que `.env` está no `.gitignore` da raiz

**Aceite:** `git status -s` mostra apenas os arquivos acima; diretórios vazios com `.gitkeep` se necessário.

---

## T0.2 — Branches e branch protection
- [x] Criar branch `develop` a partir de `main` e fazer push
- [x] Configurar branch protection em `main` no GitHub Settings → Branches:
  - [x] Require PR before merging (1 approval)
  - [x] Require status checks: `test` — **declarado mas inativo** até T5.1 adicionar o job real. Documentado como "required but non-blocking" no GitHub até lá.
  - [x] Block force-push, block deletion, block direct push
- [x] Configurar branch protection em `develop`:
  - [x] Require PR before merging (0 approvals ok)
  - [x] Require status checks: `test`
  - [x] Block force-push

**Aceite:** tentar push direto em `main` é rejeitado; PRs exigem revisão.

---

## T0.3 — README e CLAUDE.md inicial
- [x] Atualizar `README.md` com: descrição do projeto (1 parágrafo), stack (tabela), pré-requisitos (Java 21, Node 20, Docker, Supabase CLI), link para `docs/`
- [x] Seção "Como rodar local" com placeholder — será preenchida ao longo das fases seguintes
- [x] Seção "Variáveis de ambiente" listando todas previstas (mesmo sem valor ainda)
- [x] Atualizar seção "Comandos" do `CLAUDE.md`: adicionar nota de que os comandos serão populados ao longo das fases 0–3

**Aceite:** novo dev consegue entender em 5 min o que é o projeto e onde estão as decisões.

---

## Estado

✅ Concluída em commit `ddec1a8`.
