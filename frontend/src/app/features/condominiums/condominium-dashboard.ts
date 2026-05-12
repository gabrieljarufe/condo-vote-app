import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';

type State = { loading: true } | { loading: false; condos: readonly UserCondominium[] };

@Component({
  selector: 'app-condominium-dashboard',
  imports: [AppHeader, Spinner],
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

        <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8 text-center text-on-surface-variant">
          <span class="material-symbols-outlined mb-3" style="font-size: 36px;" aria-hidden="true">construction</span>
          <p class="text-sm">Painel em construção</p>
        </div>
      }
    </main>
  `,
})
export default class CondominiumDashboard {
  private readonly tenant = inject(TenantService);

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
}
