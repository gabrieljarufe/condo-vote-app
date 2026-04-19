# Fase 0 — Preparação do Repositório

**Objetivo:** sair de "só docs" para "projeto com estrutura de pastas e branch protection".

**Pré-requisitos:** nenhum.

---

## T0.1 — Estrutura de diretórios e gitignores
- [ ] Criar diretórios: `backend/`, `frontend/`, `infra/`, `.github/workflows/`
- [ ] Criar `backend/.gitignore` (Maven/Spring: `target/`, `.idea/`, `*.iml`, `.env`)
- [ ] Criar `frontend/.gitignore` (Angular: `node_modules/`, `dist/`, `.angular/`, `.env`)
- [ ] Criar `.editorconfig` na raiz (UTF-8, LF, 4 espaços Java, 2 espaços TS/YAML)
- [ ] Criar `.env.example` na raiz com placeholders das variáveis que vão existir
- [ ] Garantir que `.env` está no `.gitignore` da raiz

**Aceite:** `git status -s` mostra apenas os arquivos acima; diretórios vazios com `.gitkeep` se necessário.

---

## T0.2 — Branches e branch protection
- [ ] Criar branch `develop` a partir de `main` e fazer push
- [ ] Configurar branch protection em `main` no GitHub Settings → Branches:
  - [ ] Require PR before merging (1 approval)
  - [ ] Require status checks: `test` (vai existir na Fase 5 — pode deixar placeholder e ativar depois)
  - [ ] Block force-push, block deletion, block direct push
- [ ] Configurar branch protection em `develop`:
  - [ ] Require PR before merging (0 approvals ok)
  - [ ] Require status checks: `test`
  - [ ] Block force-push

**Aceite:** tentar push direto em `main` é rejeitado; PRs exigem revisão.

---

## T0.3 — README e CLAUDE.md inicial
- [ ] Atualizar `README.md` com: descrição do projeto (1 parágrafo), stack (tabela), pré-requisitos (Java 21, Node 20, Docker, Supabase CLI), link para `docs/`
- [ ] Seção "Como rodar local" com placeholder — será preenchida ao longo das fases seguintes
- [ ] Seção "Variáveis de ambiente" listando todas previstas (mesmo sem valor ainda)
- [ ] Atualizar seção "Comandos" do `CLAUDE.md`: adicionar nota de que os comandos serão populados ao longo das fases 0–3

**Aceite:** novo dev consegue entender em 5 min o que é o projeto e onde estão as decisões.
