import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, catchError, map, startWith } from 'rxjs';
import {
  MyBallotResponse,
  MyBallotsResponse,
  PollDetailResponse,
  PollsApiService,
} from '../../../core/api/polls-api.service';
import { AppHeader } from '../../../shared/layout/app-header';
import { Spinner } from '../../../shared/ui/spinner';
import { BallotCard } from './ballot-card';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; pollDetail: PollDetailResponse; myBallots: MyBallotsResponse }
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
            <p class="text-sm mb-3">{{ errorMessage() }}</p>
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

          @if (excludedApartments().length > 0) {
            <section
              role="status"
              class="bg-warning-container text-on-warning-container rounded-2xl border border-outline-variant p-5 mb-6"
            >
              <h2 class="text-sm font-semibold mb-2">
                Apartamentos fora desta votação
              </h2>
              <p class="text-sm mb-3">
                Os apartamentos abaixo ficaram fora do conjunto elegível quando a votação foi
                aberta — geralmente por inadimplência.
              </p>
              <ul class="flex flex-col gap-1">
                @for (apt of excludedApartments(); track apt.apartmentId) {
                  <li class="text-sm">Apto {{ apt.apartmentLabel }}</li>
                }
              </ul>
            </section>
          }

          <!-- Opções da poll (leitura — visível em todos os casos) -->
          @if (pollDetail()!.options.length > 0) {
            <section class="bg-surface-container-low rounded-2xl border border-outline-variant p-5 mb-6">
              <h2 class="text-sm font-semibold text-on-surface mb-3">Opções de voto</h2>
              <ul class="flex flex-col gap-2">
                @for (opt of pollDetail()!.options; track opt.id) {
                  <li class="text-sm text-on-surface flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-xs font-medium text-on-surface-variant shrink-0">
                      {{ opt.displayOrder + 1 }}
                    </span>
                    {{ opt.label }}
                  </li>
                }
              </ul>
            </section>
          }

          @switch (voteEligibility()) {
            @case ('not-eligible') {
              <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8">
                <p class="text-sm font-semibold text-on-surface mb-2">Você não pode votar nesta votação.</p>
                <p class="text-sm text-on-surface-variant mb-4">
                  Possíveis motivos: você não é o eleitor designado de nenhum apartamento,
                  ou o apartamento estava inadimplente quando a votação foi aberta.
                  Você ainda pode acompanhar o andamento e o resultado.
                </p>
                <a [routerLink]="['/app/condominiums', condoId, 'polls', pollId]"
                   class="text-primary text-sm underline">Ver detalhe da votação</a>
              </div>
            }
            @case ('all-voted') {
              <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-8 text-center">
                <p class="text-sm text-on-surface-variant mb-4">
                  Você já votou em todas as suas cédulas para esta votação.
                </p>
                <a [routerLink]="['/app/condominiums', condoId, 'my-polls']"
                   class="text-primary text-sm underline">Voltar para minhas votações</a>
              </div>
            }
            @case ('can-vote') {
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
    return s.kind === 'ready' ? s.myBallots.ballots.filter((b) => !b.alreadyVoted) : [];
  });

  protected readonly firstBallot = computed(() => this.pendingBallots()[0] ?? null);

  protected readonly excludedApartments = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.myBallots.excludedApartments : [];
  });

  protected readonly voteEligibility = computed<'not-eligible' | 'all-voted' | 'can-vote'>(() => {
    const s = this.state();
    if (s.kind !== 'ready') return 'can-vote';
    const ballots = s.myBallots.ballots;
    if (ballots.length === 0) return 'not-eligible';
    if (ballots.every((b) => b.alreadyVoted)) return 'all-voted';
    return 'can-vote';
  });

  protected readonly pollDetail = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.pollDetail : null;
  });

  protected readonly errorMessage = computed(() => {
    const s = this.state();
    return s.kind === 'error' ? s.message : '';
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
