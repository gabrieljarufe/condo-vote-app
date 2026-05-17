import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, startWith } from 'rxjs';
import { MyPendingPollResponse, PollsApiService } from '../../../core/api/polls-api.service';
import { AppHeader } from '../../../shared/layout/app-header';
import { Spinner } from '../../../shared/ui/spinner';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; polls: ReadonlyArray<MyPendingPollResponse> }
  | { kind: 'error'; message: string };

@Component({
  selector: 'app-resident-pending-polls-page',
  imports: [AppHeader, Spinner, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-3xl mx-auto px-6 py-12">
      <h1 class="text-2xl font-semibold text-on-surface mb-2">Minhas votações</h1>
      <p class="text-sm text-on-surface-variant mb-8">Votações abertas com cédulas pendentes para você.</p>

      @switch (state().kind) {
        @case ('loading') {
          <div class="flex justify-center py-12">
            <app-spinner label="Carregando…" />
          </div>
        }
        @case ('error') {
          <div class="bg-error-container text-on-error-container rounded-2xl p-6">
            <p class="text-sm">Erro ao carregar votações: {{ errorMessage() }}</p>
          </div>
        }
        @case ('ready') {
          @if (polls().length === 0) {
            <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8 text-center text-on-surface-variant">
              <span class="material-symbols-outlined mb-3" style="font-size: 36px;" aria-hidden="true">how_to_vote</span>
              <p class="text-sm">Você não tem votações pendentes.</p>
            </div>
          } @else {
            <ul class="space-y-3">
              @for (p of polls(); track p.pollId) {
                <li>
                  <a
                    [routerLink]="['/app/condominiums', condoId(), 'polls', p.pollId, 'vote']"
                    class="flex items-center justify-between bg-surface-container-low rounded-2xl border border-outline-variant p-6 hover:bg-surface-container transition-colors"
                  >
                    <div>
                      <p class="font-semibold text-on-surface">{{ p.title }}</p>
                      <p class="text-xs text-on-surface-variant mt-1">
                        Encerra em {{ p.scheduledEnd | date: 'short' }}
                      </p>
                    </div>
                    <span class="rounded-full bg-primary-container text-on-primary-container text-xs font-medium px-3 py-1">
                      {{ p.pendingBallotsCount }} pendentes
                    </span>
                  </a>
                </li>
              }
            </ul>
          }
        }
      }
    </main>
  `,
})
export default class ResidentPendingPollsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PollsApiService);

  protected readonly condoId = computed(() => this.route.snapshot.paramMap.get('condoId') ?? '');

  protected readonly state = toSignal(
    this.api.getMyPendingPolls(this.condoId()).pipe(
      map((polls): State => ({ kind: 'ready', polls })),
      catchError((err): State[] => [{ kind: 'error', message: err?.message ?? 'erro' }]),
      startWith<State>({ kind: 'loading' }),
    ),
    { initialValue: { kind: 'loading' } as State },
  );

  protected readonly polls = computed(() =>
    this.state().kind === 'ready'
      ? (this.state() as { kind: 'ready'; polls: ReadonlyArray<MyPendingPollResponse> }).polls
      : [],
  );

  protected readonly errorMessage = computed(() =>
    this.state().kind === 'error' ? (this.state() as { kind: 'error'; message: string }).message : '',
  );
}
