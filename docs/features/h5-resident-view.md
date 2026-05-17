# H5 — Morador vê apartamentos onde reside

> Fecha o loop iniciado por H4: o morador que acabou de criar conta via
> magic link agora abre a lista de apartamentos do condomínio e vê
> apenas as unidades onde figura como `apartment_resident` ativo —
> síndico continua vendo todos.

## O que foi validado

- **Unit tests backend**: `ApartmentServiceTest` ganhou cenários
  role-aware — síndico chama `findByCondominiumId` (todos), morador
  chama `findActiveResidencyApartments` (filtrado), morador sem
  residência ativa retorna página vazia.
- **Integration test backend**: `ApartmentControllerIT` exercita o GET
  `/api/condominiums/{id}/apartments` com dois JWTs distintos (síndico
  e morador) contra o mesmo condomínio com Testcontainers, validando
  isolamento real via RLS + filtro de service.
- **Specs frontend**: `apartments-page.spec.ts` cobre branch de UI
  role-aware (botões de criação/inadimplência só aparecem para admin);
  `admin.guard.spec.ts` cobre rota protegida (morador é redirecionado
  para o dashboard).
- **`adminGuard`** novo em `core/tenant/admin.guard.ts` aplicado às
  rotas de invitations e criação/edição de apartamento; `home.routes.ts`
  atualizado.
- **`mvnw verify`** passa com JaCoCo (≥50% LINE, ≥40% BRANCH).
- **Vitest full**: specs passando após adição dos novos.

## O que ainda falta testar (não-bloqueante para MVP)

- **Smoke end-to-end real** — logar em prod como morador (conta criada
  via H4) e abrir `/app/condominiums/<id>/apartments`; confirmar que só
  o apto onde ele é residente aparece e que botões de admin estão
  ausentes. Depende de H4 ter sido validada em prod.
- **Morador com residências em condomínios distintos** — UT cobre
  filtro por condomínio + RLS, mas falta IT com usuário multi-condo
  trocando o tenant via header e validando a interseção.
- **Morador com `apartment_resident.ended_at` preenchido (saída
  formalizada)** — service exclui via cláusula `ended_at IS NULL`, sem
  IT explícito que insere residência encerrada e verifica que some.
- **Morador OWNER + TENANT no mesmo condo (mix de papéis no mesmo
  `Set<roles>`)** — caso raro; nenhum cenário cobre hoje.

## Refinamento de UX adiado (consciente)

A home atual (`HomeComponent` + `CondominiumDashboard`) trata todo
usuário como síndico: renderiza cards de navegação ("Apartamentos",
"Convites") mesmo quando o usuário é morador comum de **um único**
apartamento. Para esse perfil — que será a maioria absoluta dos
usuários — o ideal seria renderizar a "view direta" do apartamento
diretamente na home, sem clique extra.

**Por que adiado:** prazo de entrega (3 dias). H5 entrega o backend
correto e a página `/apartments` filtrada; a UX de hub-vs-direto é
polimento que não bloqueia o piloto.

**Por que será barato fazer depois:** trabalho é puramente de
frontend. Arquitetura atual já suporta sem qualquer mudança de
contrato no backend:

- `GET /api/me/condominiums` (`CondominiumSummary`) já retorna `name`
  + `Set<UserRoleInCondo>` por condomínio — sem chamada extra.
- `TenantService` já expõe `isAdmin()`, `isResident()`, `activeRoles()`
  (`core/tenant/tenant.service.ts:22-24`).
- O `condoName` já é resolvido via lookup em memória no dashboard
  (`condominium-dashboard.ts:83-86`).

**Gatilho para retomar:** quando houver folga pós-piloto, refatorar
`features/home/home.ts` adicionando branch
`condos.length === 1 && isResident && !isAdmin` → renderizar dados do
apto inline (provável extração de `ApartmentSummaryCard` reutilizável).
Eventual campo `role` (OWNER/TENANT) por apartamento em
`ApartmentResponse` só se torna necessário quando H6 (promoção) ou um
caso real de mix de papéis aparecer — adicionar como campo opcional,
sem breaking change.

## Pré-requisitos para teste em produção

1. **H4 validada em prod** — sem residentes reais criados, H5 não tem
   dado pra mostrar.
2. **Pelo menos um condomínio com 2+ apartamentos e o mesmo morador
   ligado a apenas um deles** — para evidenciar visualmente o filtro
   funcionando.

## Histórias dependentes (consumirão H5)

- **H6** — Promoção a co-síndico / delegação de voto. Reusa
  `findActiveResidencyApartments` para popular dropdowns de "quais
  residentes posso promover".
- **H8** — Voto. Morador precisa ver "em qual apto estou votando".
