import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { PollsApiService } from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';

type State = { loading: true } | { loading: false; condos: readonly UserCondominium[] };

@Component({
  selector: 'app-condominium-dashboard',
  imports: [AppHeader, Spinner, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header [condominiums]="condominiums()" />

    <main class="max-w-3xl mx-auto px-6 py-12">
      @if (state().loading) {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando…" />
        </div>
      } @else {
        <h1 class="text-2xl font-semibold text-on-surface mb-2">{{ condoName() }}</h1>
        <p class="text-sm text-on-surface-variant mb-8">
          Seu painel será exibido aqui conforme as próximas funcionalidades forem implementadas.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <a
            [routerLink]="['/app/condominiums', condoId(), 'apartments']"
            class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
          >
            <span class="material-symbols-outlined text-secondary" style="font-size: 32px;" aria-hidden="true">apartment</span>
            <div>
              <p class="font-semibold text-on-surface">Apartamentos</p>
              <p class="text-xs text-on-surface-variant mt-0.5">
                {{ isAdmin() ? 'Gerencie unidades e inadimplência' : 'Onde você reside' }}
              </p>
            </div>
          </a>

          @if (isAdmin()) {
            <a
              [routerLink]="['/app/condominiums', condoId(), 'invitations']"
              class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
            >
              <span class="material-symbols-outlined text-secondary" style="font-size: 32px;" aria-hidden="true">mail</span>
              <div>
                <p class="font-semibold text-on-surface">Convites</p>
                <p class="text-xs text-on-surface-variant mt-0.5">Convide moradores por e-mail</p>
              </div>
            </a>
          }

          <a
            [routerLink]="['/app/condominiums', condoId(), 'polls']"
            class="flex items-center gap-4 bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
          >
            <span class="material-symbols-outlined text-secondary" style="font-size: 32px;" aria-hidden="true">how_to_vote</span>
            <div class="flex-1">
              <p class="font-semibold text-on-surface">Votações</p>
              <p class="text-xs text-on-surface-variant mt-0.5">{{ pollsSubtitle() }}</p>
            </div>
            @if (isResident() && pendingPollsCount() > 0) {
              <span class="rounded-full bg-primary text-on-primary text-xs font-bold px-2.5 py-1">
                {{ pendingPollsCount() }}
              </span>
            }
          </a>
        </div>

        <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8 text-center text-on-surface-variant">
          <span class="material-symbols-outlined mb-3" style="font-size: 36px;" aria-hidden="true">construction</span>
          <p class="text-sm">Mais funcionalidades em breve</p>
        </div>
      }
    </main>
  `,
})
export default class CondominiumDashboard {
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

  protected readonly pendingPollsCount = toSignal(
    this.pollsApi.getMyPendingPolls(this.tenant.activeCondominiumId() ?? '').pipe(
      map((polls) => polls.length),
      catchError(() => of(0)),
    ),
    { initialValue: 0 },
  );

  protected readonly pollsSubtitle = computed(() => {
    if (!this.isResident()) {
      return 'Crie e gerencie enquetes e votações';
    }
    const pending = this.pendingPollsCount();
    if (pending === 0) return 'Acompanhe e participe';
    const suffix = pending > 1 ? 's' : '';
    return `${pending} pendente${suffix}`;
  });
}
