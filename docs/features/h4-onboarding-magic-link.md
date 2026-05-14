# H4 — Morador completa cadastro via magic link

> Fecha o loop iniciado por H3: o e-mail enviado pelo síndico agora aterrissa
> em uma tela funcional de aceite + criação de conta.

## O que foi validado

- **Unit tests backend**: `OnboardingServiceTest` (4 testes) cobre token
  inexistente → NOT_FOUND, CPF não confere → IllegalArgument, invitation já
  ACCEPTED → ConflictException, token Redis ausente no `complete` →
  ConflictException.
- **Integration test backend**: `OnboardingControllerIT` (3 testes) sobe
  Testcontainers Postgres, mocka Supabase + Redis e exercita o fluxo real:
  validate sem token → NOT_FOUND; happy-path POST `/api/public/register/complete`
  → 201, `app_user` criado, `apartment_resident` ligado, `invitation.ACCEPTED`,
  `audit_event` publicado; CPF errado → 400.
- **Specs frontend**: `invitation-accept-page.spec.ts` (4 testes) cobre
  renderização VALID com label do apto, submit happy → `router.navigate('/login',
  {registered:'1'})`, estado EXPIRED renderiza tela de erro, 400 do backend
  exibe "CPF não confere".
- **`mvnw verify`** passa com JaCoCo (≥50% LINE, ≥40% BRANCH).
- **Vitest full**: 140/140 specs passando.

## O que ainda falta testar (não-bloqueante para MVP)

- **Smoke end-to-end real** (Supabase CLI + docker compose + ng serve + Inbucket).
  Plano detalhado em `~/.claude/plans/users-gabrieljarufe-claude-plans-entreg-structured-river.md`
  seção "Verificação end-to-end". Bloqueado pelo merge de H3 (PR #75).
- **Tentativa de aceite com convite já ACCEPTED** — UT cobre, mas falta IT
  reaproveitando o mesmo token.
- **Convite REVOKED + REVOKED na validação** — frontend tem branch, mas sem
  IT que insere convite REVOKED e valida o `state` retornado.
- **Rate-limit 429** — implementado mas sem teste; manual: disparar
  `/api/public/invitations/validate` 25× em <1min e esperar 429 na 21ª.
- **CPF com máscara vs sem máscara** — backend normaliza (CpfEncryptor strip-a
  `.` e `-`), mas falta IT explícito que mande os dois formatos.
- **Reuso de e-mail existente** — caso `app_user.email` já existe → backend
  retorna 409 ("já tem conta, faça login"). Validado por inspeção; sem IT.

## Bugs/limitações conhecidos (assumidos por escopo)

- **Rate-limit é in-memory.** Quando virar multi-instância, precisa de bucket
  distribuído (Redis). OK para piloto single-instance.
- **Sem validação de dígito verificador do CPF** — só ciphertext-match. Se
  síndico cadastrar CPF inválido no H3, o morador também precisa digitar o
  mesmo CPF inválido para passar.
- **Sem auto-login pós-cadastro** — usuário vai para `/login` com toast e
  precisa autenticar manualmente. Decisão consciente para minimizar superfície.
- **Sem fluxo de merge de e-mail existente** — se a pessoa já tem conta com
  o mesmo e-mail (caso v2 com transferência de titularidade), o aceite falha
  com 409. Adiado para v2.

## Pré-requisitos para teste em produção

1. **H3 (PR #75) mergeada e deployada** — sem ela não há link sendo enviado.
2. **DNS Resend configurado** — ver `docs/runbooks/resend-dns-setup.md`.
3. **`SUPABASE_SERVICE_ROLE_KEY` configurado no Coolify** — `SupabaseAdminGateway`
   precisa criar `auth.users`.
4. **`CPF_ENCRYPTION_KEY` idêntico entre staging e prod** — ciphertext
   determinístico não decifra cross-env se as chaves divergirem.
5. **Cloudflare Pages com `_redirects` SPA fallback** — sem ele, deep-link
   `/invitations/<token>` em refresh dá 404. Já validado em H1.

## Histórias dependentes (consumirão H4)

- **H5** — Morador vê apartamentos onde reside. Depende de `apartment_resident`
  populado pelo aceite.
- **H7/H8** — Criar votação + votar. Dependem do usuário existir como
  resident no condomínio.
