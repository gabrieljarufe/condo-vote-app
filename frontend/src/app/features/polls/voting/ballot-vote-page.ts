// B6: Adicionar banner de inadimplência quando tiver API para comparar
// cédulas no snapshot com lista completa de apartments do usuário no condo.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, catchError, map, startWith } from 'rxjs';
import {
  MyBallotResponse,
  PollDetailResponse,
  PollsApiService,
} from '../../../core/api/polls-api.service';
import { AppHeader } from '../../../shared/layout/app-header';
import { Spinner } from '../../../shared/ui/spinner';
import { BallotCard } from './ballot-card';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; pollDetail: PollDetailResponse; myBallots: ReadonlyArray<MyBallotResponse> }
  | { kind: 'error'; message: string };

@Component({
  selector: 'app-ballot-vote-page',
  imports: [CommonModule, AppHeader, Spinner, BallotCard, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-2xl mx-auto px-6 py-12">
      @switch (state().kind) {
        @case ('loading') {
          <div class="flex justify-center py-12">
            <app-spinner label="Carregando…" />
          </div>
        }
        @case ('error') {
          <div class="bg-error-container text-on-error-container rounded-2xl p-6">
            <p class="text-sm mb-3">{{ state().message }}</p>
            <a [routerLink]="['/app/condominiums', condoId, 'my-polls']"
               class="text-sm underline">Voltar para minhas votações</a>
          </div>
        }
        @case ('ready') {
          <h1 class="text-2xl font-semibold text-on-surface mb-2">
            {{ pollDetail()!.poll.title }}
          </h1>
          @if (pollDetail()!.poll.description) {
            <p class="text-sm text-on-surface-variant mb-6">
              {{ pollDetail()!.poll.description }}
            </p>
          }

          @if (pendingBallots().length === 0) {
            <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8 text-center">
              <p class="text-sm text-on-surface-variant mb-4">
                Você já votou em todas as suas cédulas para esta votação.
              </p>
              <a [routerLink]="['/app/condominiums', condoId, 'my-polls']"
                 class="text-primary text-sm underline">Voltar para minhas votações</a>
            </div>
          } @else {
            @if (pendingBallots().length > 1) {
              <p class="text-xs text-on-surface-variant mb-4">
                Você tem {{ pendingBallots().length }} apartamentos elegíveis nesta votação.
                Votaremos primeiro no apto {{ firstBallot()!.apartmentLabel }}.
              </p>
            }

            <app-ballot-card
              [apartmentLabel]="firstBallot()!.apartmentLabel"
              [options]="pollDetail()!.options"
              [selectedOptionId]="selectedOptionId()"
              (optionChange)="onOptionChange($event)"
            />

            @if (submitError()) {
              <p class="text-error text-sm mt-4">{{ submitError() }}</p>
            }

            <button
              class="w-full mt-6 bg-primary text-on-primary rounded-2xl py-3 font-semibold disabled:opacity-50"
              [disabled]="!selectedOptionId() || submitting()"
              (click)="onConfirm()"
            >
              {{ submitting() ? 'Enviando…' : 'Confirmar voto' }}
            </button>
          }

          @if (showBulkPrompt()) {
            <div class="fixed inset-0 bg-scrim/50 flex items-center justify-center z-50">
              <div class="bg-surface-container rounded-2xl p-6 max-w-md mx-4 w-full">
                <h2 class="font-semibold text-on-surface mb-2">
                  Aplicar aos demais apartamentos?
                </h2>
                <p class="text-sm text-on-surface-variant mb-4">
                  Você tem {{ pendingBallots().length - 1 }}
                  cédula(s) ainda pendente(s). Deseja revisar e aplicar a mesma opção?
                </p>
                <div class="flex gap-2 justify-end">
                  <button
                    (click)="onSkipBulk()"
                    class="px-4 py-2 rounded-xl text-sm text-on-surface border border-outline-variant"
                  >
                    Não, só esta
                  </button>
                  <button
                    (click)="onApplyBulk()"
                    class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm"
                  >
                    Revisar e aplicar
                  </button>
                </div>
              </div>
            </div>
          }
        }
      }
    </main>
  `,
})
export default class BallotVotePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PollsApiService);

  protected readonly condoId = this.route.snapshot.paramMap.get('condoId') ?? '';
  protected readonly pollId = this.route.snapshot.paramMap.get('pollId') ?? '';

  protected readonly state = toSignal(
    combineLatest([
      this.api.getById(this.pollId),
      this.api.getMyBallots(this.pollId),
    ]).pipe(
      map(([pollDetail, myBallots]): LoadState => ({ kind: 'ready', pollDetail, myBallots })),
      catchError((err): LoadState[] => [
        { kind: 'error', message: err?.message ?? 'Erro ao carregar votação.' },
      ]),
      startWith<LoadState>({ kind: 'loading' }),
    ),
    { initialValue: { kind: 'loading' } as LoadState },
  );

  protected readonly selectedOptionId = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly showBulkPrompt = signal(false);

  protected readonly pendingBallots = computed<ReadonlyArray<MyBallotResponse>>(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.myBallots.filter((b) => !b.alreadyVoted) : [];
  });

  protected readonly firstBallot = computed(() => this.pendingBallots()[0] ?? null);

  protected readonly pollDetail = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.pollDetail : null;
  });

  protected onOptionChange(optionId: string): void {
    this.selectedOptionId.set(optionId);
  }

  protected onConfirm(): void {
    const ballot = this.firstBallot();
    const optId = this.selectedOptionId();
    if (!ballot || !optId) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.api.submitVote(this.pollId, ballot.apartmentId, optId, false).subscribe({
      next: () => {
        this.submitting.set(false);
        if (this.pendingBallots().length > 1) {
          this.showBulkPrompt.set(true);
        } else {
          this.router.navigate(['/app/condominiums', this.condoId, 'my-polls']);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        const msg =
          err?.status === 409
            ? 'A votação foi encerrada. Volte para a lista.'
            : 'Falha ao registrar voto. Tente novamente.';
        this.submitError.set(msg);
      },
    });
  }

  protected onSkipBulk(): void {
    this.router.navigate(['/app/condominiums', this.condoId, 'my-polls']);
  }

  protected onApplyBulk(): void {
    const s = this.state();
    if (s.kind !== 'ready') return;
    this.router.navigate(
      ['/app/condominiums', this.condoId, 'polls', this.pollId, 'vote', 'review'],
      {
        state: {
          appliedOptionId: this.selectedOptionId(),
          remainingBallots: this.pendingBallots().slice(1),
          pollOptions: s.pollDetail.options,
          pollTitle: s.pollDetail.poll.title,
        },
      },
    );
  }
}
