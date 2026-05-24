import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, startWith } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { PollsApiService } from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';

type State = { loading: true } | { loading: false; condos: readonly UserCondominium[] };

@Component({
  selector: 'app-condominium-dashboard',
  imports: [AppHeader, Spinner, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header [condominiums]="condominiums()" />

    <main class="max-w-4xl mx-auto px-6 py-12">
      @if (state().loading) {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando…" />
        </div>
      } @else {
        <h1 class="text-2xl font-semibold text-on-surface mb-2">{{ condoName() }}</h1>
        <p class="text-sm text-on-surface-variant mb-8">
          Seu painel será exibido aqui conforme as próximas funcionalidades forem implementadas.
        </p>

        @if (isHybrid()) {
          @for (section of orderedSections(); track section) {
            @if (section === 'participate') {
              <section aria-labelledby="participate-heading" class="mb-10">
                <h2
                  id="participate-heading"
                  class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3"
                >
                  Participar
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ng-container *ngTemplateOutlet="pollsCard; context: { hybrid: true }" />
                  <ng-container *ngTemplateOutlet="apartmentsCard; context: { variant: 'resident' }" />
                </div>
              </section>
            } @else {
              <section aria-labelledby="manage-heading" class="mb-10">
                <h2
                  id="manage-heading"
                  class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3"
                >
                  Gerenciar
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ng-container *ngTemplateOutlet="apartmentsCard; context: { variant: 'admin' }" />
                  <ng-container *ngTemplateOutlet="invitationsCard" />
                  <ng-container *ngTemplateOutlet="createPollCard" />
                </div>
              </section>
            }
          }
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <ng-container
              *ngTemplateOutlet="apartmentsCard; context: { variant: isAdmin() ? 'admin' : 'resident' }"
            />
            @if (isAdmin()) {
              <ng-container *ngTemplateOutlet="invitationsCard" />
            }
            <ng-container *ngTemplateOutlet="pollsCard; context: { hybrid: false }" />
          </div>
        }

        <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8 text-center text-on-surface-variant">
          <span class="material-symbols-outlined mb-3" style="font-size: 36px;" aria-hidden="true">construction</span>
          <p class="text-sm">Mais funcionalidades em breve</p>
        </div>
      }
    </main>

    <ng-template #apartmentsCard let-variant="variant">
      <a
        [routerLink]="['/app/condominiums', condoId(), 'apartments']"
        class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
      >
        <span class="material-symbols-outlined text-primary" style="font-size: 32px;" aria-hidden="true">apartment</span>
        <div>
          <p class="font-semibold text-on-surface">Apartamentos</p>
          <p class="text-xs text-on-surface-variant mt-0.5">
            {{ variant === 'admin' ? 'Gerencie unidades e inadimplência' : 'Acesse o seu apartamento' }}
          </p>
        </div>
      </a>
    </ng-template>

    <ng-template #invitationsCard>
      <a
        [routerLink]="['/app/condominiums', condoId(), 'invitations']"
        class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
      >
        <span class="material-symbols-outlined text-primary" style="font-size: 32px;" aria-hidden="true">mail</span>
        <div>
          <p class="font-semibold text-on-surface">Convites</p>
          <p class="text-xs text-on-surface-variant mt-0.5">Convide moradores por e-mail</p>
        </div>
      </a>
    </ng-template>

    <ng-template #createPollCard>
      <a
        [routerLink]="['/app/condominiums', condoId(), 'polls', 'new']"
        class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
      >
        <span class="material-symbols-outlined text-primary" style="font-size: 32px;" aria-hidden="true">add_circle</span>
        <div>
          <p class="font-semibold text-on-surface">Criar votação</p>
          <p class="text-xs text-on-surface-variant mt-0.5">Abra uma nova deliberação</p>
        </div>
      </a>
    </ng-template>

    <ng-template #pollsCard let-hybrid="hybrid">
      <a
        [routerLink]="['/app/condominiums', condoId(), 'polls']"
        class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
      >
        <span class="material-symbols-outlined text-primary" style="font-size: 32px;" aria-hidden="true">how_to_vote</span>
        <div class="flex-1">
          <p class="font-semibold text-on-surface">Votações</p>
          <p class="text-xs text-on-surface-variant mt-0.5">{{ pollsSubtitle(hybrid) }}</p>
        </div>
        @if (showPendingBadge(hybrid)) {
          <span
            class="rounded-full bg-primary text-on-primary text-xs font-bold px-2.5 py-1"
            [attr.aria-label]="pendingBadgeAriaLabel()"
          >
            {{ pendingBallotsCount() }}
          </span>
        }
      </a>
    </ng-template>
  `,
})
export default class CondominiumDashboard implements OnInit {
  private readonly tenant = inject(TenantService);
  private readonly pollsApi = inject(PollsApiService);

  protected readonly state = toSignal(
    inject(MeApiService).getCondominiums().pipe(
      map((condos): State => ({ loading: false, condos })),
      catchError((): State[] => [{ loading: false, condos: [] }]),
      startWith<State>({ loading: true }),
    ),
    { initialValue: { loading: true } as State },
  );

  protected readonly condominiums = computed<readonly UserCondominium[]>(() => {
    const s = this.state();
    return s.loading ? [] : s.condos;
  });

  protected readonly condoName = computed(() => {
    const id = this.tenant.activeCondominiumId();
    return this.condominiums().find((c) => c.id === id)?.name ?? '';
  });

  protected readonly condoId = computed(() => this.tenant.activeCondominiumId() ?? '');

  protected readonly isAdmin = computed(() => this.tenant.activeRoles().has('ADMIN'));

  protected readonly isResident = computed(() => this.tenant.isResident());

  protected readonly isHybrid = computed(() => this.isAdmin() && this.isResident());

  // Quando há cédulas pendentes, "Participar" sobe (Goal-Gradient Effect).
  // Sem pendências, "Gerenciar" primeiro — identidade primária do síndico-morador é administrativa.
  protected readonly orderedSections = computed<readonly ('participate' | 'manage')[]>(() => {
    return this.pendingBallotsCount() > 0
      ? ['participate', 'manage']
      : ['manage', 'participate'];
  });

  // Soma de cédulas pendentes (não de polls) — uma poll pode ter N cédulas se o
  // morador possui múltiplos apartamentos. Carregado em ngOnInit porque depende do
  // tenantRestoreGuard ter hidratado activeCondominiumId.
  protected readonly pendingBallotsCount = signal(0);

  ngOnInit(): void {
    if (!this.isResident()) return;
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) return;
    this.pollsApi.getMyPendingPolls(condoId).subscribe({
      next: (polls) =>
        this.pendingBallotsCount.set(
          polls.reduce((acc, p) => acc + p.pendingBallotsCount, 0),
        ),
      error: () => this.pendingBallotsCount.set(0),
    });
  }

  // Em layout híbrido, o card "Votações" vive em "Participar" — sempre na visão morador.
  // Em layout plano, o subtítulo segue o papel único do usuário.
  protected pollsSubtitle(hybrid: boolean): string {
    if (!hybrid && !this.isResident()) {
      return 'Crie e gerencie enquetes e votações';
    }
    const pending = this.pendingBallotsCount();
    if (pending === 0) return 'Acompanhe e participe';
    const suffix = pending > 1 ? 's' : '';
    return `${pending} cédula${suffix} pendente${suffix}`;
  }

  protected showPendingBadge(hybrid: boolean): boolean {
    const inResidentContext = hybrid || this.isResident();
    return inResidentContext && this.pendingBallotsCount() > 0;
  }

  protected pendingBadgeAriaLabel(): string {
    const n = this.pendingBallotsCount();
    return n === 1 ? '1 cédula pendente de voto' : `${n} cédulas pendentes de voto`;
  }
}
