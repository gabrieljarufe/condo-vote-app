import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, startWith } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { EmptyState } from '../../shared/ui/empty-state';
import { Spinner } from '../../shared/ui/spinner';
import { rolesLabel } from './home-utils';

type LoadResult =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; data: readonly UserCondominium[] };

@Component({
  selector: 'app-home',
  imports: [AppHeader, EmptyState, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header [condominiums]="condominiums()" />

    <main class="max-w-3xl mx-auto px-6 py-12">
      @switch (state().kind) {
        @case ('loading') {
          <div class="flex justify-center py-12">
            <app-spinner label="Carregando seus condomínios…" />
          </div>
        }

        @case ('error') {
          <app-empty-state
            icon="error"
            title="Não foi possível carregar"
            [description]="errorMessage()"
          />
        }

        @case ('success') {
          @if (condominiums().length === 0) {
            <app-empty-state
              icon="apartment"
              title="Você ainda não está vinculado a nenhum condomínio"
              description="Peça ao síndico do seu condomínio para vincular sua conta a uma unidade."
            />
          } @else {
            <section>
              <h1 class="text-2xl font-semibold text-on-surface mb-2">Selecione um condomínio</h1>
              <p class="text-sm text-on-surface-variant mb-8">
                Você está vinculado a {{ condominiums().length }} condomínio(s). Escolha em qual deseja entrar agora.
              </p>

              <ul class="flex flex-col gap-3">
                @for (c of condominiums(); track c.id) {
                  <li>
                    <button
                      type="button"
                      (click)="selectCondo(c)"
                      class="w-full flex items-center justify-between gap-4 p-5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-secondary transition-all text-left"
                    >
                      <span class="flex items-center gap-3">
                        <span class="w-10 h-10 rounded-lg bg-secondary-fixed text-secondary grid place-items-center" aria-hidden="true">
                          <span class="material-symbols-outlined">apartment</span>
                        </span>
                        <span>
                          <span class="block text-base font-medium text-on-surface">{{ c.name }}</span>
                          <span class="block text-xs text-on-surface-variant">{{ rolesLabel(c.roles) }}</span>
                        </span>
                      </span>
                      <span class="material-symbols-outlined text-on-surface-variant" aria-hidden="true">arrow_forward</span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        }
      }
    </main>
  `,
})
export default class Home {
  private readonly meApi = inject(MeApiService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  private readonly state$: Observable<LoadResult> = this.meApi.getCondominiums().pipe(
    map((data): LoadResult => ({ kind: 'success', data })),
    catchError((e: unknown): Observable<LoadResult> => {
      const message = e instanceof Error ? e.message : 'Erro de rede';
      return of({ kind: 'error', message });
    }),
    startWith<LoadResult>({ kind: 'loading' }),
  );

  protected readonly state = toSignal(this.state$, { initialValue: { kind: 'loading' } as LoadResult });

  protected readonly condominiums = computed<readonly UserCondominium[]>(() => {
    const s = this.state();
    return s.kind === 'success' ? s.data : [];
  });

  protected readonly errorMessage = computed(() => {
    const s = this.state();
    return s.kind === 'error' ? s.message : '';
  });

  constructor() {
    effect(() => {
      const list = this.condominiums();
      if (list.length === 1 && !this.tenant.activeCondominiumId()) {
        this.navigateToCondo(list[0]);
      }
    });
  }

  protected selectCondo(c: UserCondominium): void {
    this.navigateToCondo(c);
  }

  private navigateToCondo(c: UserCondominium): void {
    this.tenant.setActive(c.id, c.roles);
    void this.router.navigate(['/app/condominiums', c.id]);
  }

  protected readonly rolesLabel = rolesLabel;
}
