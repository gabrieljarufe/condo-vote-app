# Frontend — Definition of Done de uma feature

Checklist obrigatório para qualquer feature antes do merge em `main`. Funciona em conjunto com `coding-patterns.md §Frontend`.

> **Como usar:** copie este checklist na descrição do PR e marque cada item. PR sem checklist verde **não merge**.

## Estrutura e arquitetura

- [ ] Pasta criada em `src/app/features/<aggregate>/` espelhando o package backend (mesmo nome, mesmo singular/plural)
- [ ] Service de API criado em `core/api/<aggregate>-api.service.ts` (cross-tenant) ou `features/<aggregate>/<aggregate>-api.service.ts` (tenant-bound). `providedIn: 'root'`. Retorna `Observable<T>`.
- [ ] Smart component(s) na feature; UI reutilizável em `shared/ui/`. **Componentes de `shared/ui/` não injetam services de domínio.**
- [ ] Rota registrada como **lazy** (`loadComponent` ou `loadChildren`)
- [ ] Se a rota é protegida, `canActivate: [authGuard]` aplicado

## Componentes

- [ ] Standalone (sem `standalone: true` explícito — é default no v20+)
- [ ] `changeDetection: ChangeDetectionStrategy.OnPush`
- [ ] `input()` / `output()` (funções), nunca `@Input` / `@Output` decorators
- [ ] `computed()` para estado derivado
- [ ] Template usa `@if`, `@for`, `@switch` — **nunca** `*ngIf` / `*ngFor` / `*ngSwitch`
- [ ] Bindings: `[class.x]` / `[style.x]` — nunca `ngClass` / `ngStyle`
- [ ] Sem `@HostBinding` / `@HostListener` (usar objeto `host` no decorator)
- [ ] Sem arrow functions ou regex no template
- [ ] `inject()` em vez de constructor injection

## Estado

- [ ] Signals para estado local (`signal()`, `computed()`, `update()`/`set()`)
- [ ] **Nunca** `mutate` em signal
- [ ] Observables HTTP convertidos via `toSignal()` quando consumidos no template
- [ ] Sem `BehaviorSubject` para estado local
- [ ] Sem biblioteca externa de state (NgRx/Akita) — não-objetivo na v1

## Forms (se houver)

- [ ] Reactive Forms apenas (`FormGroup`, `FormControl`)
- [ ] Validators tipados; custom validators tipados também
- [ ] Usa `<app-form-field>` do `shared/ui/` para label + erro consistente
- [ ] Mensagens de erro com `aria-live="polite"`
- [ ] `<label for="...">` ligado a cada input

## Estados de UX (todos tratados explicitamente)

- [ ] Loading (spinner ou skeleton)
- [ ] Empty (mensagem clara, não tabela vazia)
- [ ] Error (mensagem acionável, não stack trace)
- [ ] Success (estado normal)

## Design system

- [ ] Cores referenciam tokens `@theme` (`bg-secondary`, `text-on-surface`) — **zero hex literais** em componentes
- [ ] Spacing usa tokens (`p-md`, `gap-base`) — sem `24px` hardcoded
- [ ] Tipografia: 1 `display-lg` máximo por página, hierarquia clara
- [ ] Mobile-first: layout testado em ≤ 375px de largura

## Acessibilidade (WCAG AA — bloqueante)

- [ ] `axe DevTools` zero erros AA nas páginas tocadas
- [ ] Contraste verificado para qualquer cor nova
- [ ] Focus ring visível em todo elemento interativo
- [ ] Navegação por teclado completa (Tab, Shift+Tab, Enter, Esc)
- [ ] `NgOptimizedImage` em toda imagem estática
- [ ] `alt` descritivo em imagens (não "image", não vazio se decorativa → `alt=""`)
- [ ] Botões com texto OU `aria-label` se só ícone

## TypeScript / qualidade

- [ ] `strict: true` respeitado, zero `any`
- [ ] Sem `console.log` / `console.warn` mergeados
- [ ] Sem `TODO` / `FIXME` sem issue rastreável
- [ ] Imports organizados, sem imports não usados
- [ ] Build de produção passa: `npm run build -- --configuration=production`

## HTTP

- [ ] Chamadas só para `environment.apiUrl` (sem URLs hardcoded)
- [ ] Endpoints cross-tenant (`/api/me/**`, `/api/register/**`) **não** recebem `X-Tenant-Id` (interceptor já trata, mas confirmar não força)
- [ ] Tratamento de erro HTTP no service ou no component (não silenciar)

## Testes (quando aplicável na fase atual)

- [ ] Service: unit test com `HttpClientTestingModule` ou `provideHttpClientTesting`
- [ ] Smart component: teste de estado (loading/empty/error/success)
- [ ] Guard: teste de redirect (sem sessão) e permit (com sessão)

## Documentação

- [ ] Se a feature introduz novo conceito de domínio: `docs/condo-vote-principles.md` atualizado
- [ ] Se a feature muda contrato com backend: confirmar que a Bruno collection está atualizada
- [ ] `docs/STATUS.md` atualizado com qualquer descoberta não-óbvia
