import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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
import { extractErrorMessage } from '../../../shared/http/error-message';
import { AppHeader } from '../../../shared/layout/app-header';
import { Dialog } from '../../../shared/ui/dialog';
import { Dropdown, DropdownOption } from '../../../shared/ui/dropdown';
import { Spinner } from '../../../shared/ui/spinner';
import { SuccessPopup } from '../../../shared/ui/success-popup';
import { BallotCard } from './ballot-card';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; pollDetail: PollDetailResponse; myBallots: MyBallotsResponse }
  | { kind: 'error'; message: string };

@Component({
  selector: 'app-ballot-vote-page',
  imports: [CommonModule, AppHeader, Spinner, BallotCard, RouterLink, Dialog, Dropdown, SuccessPopup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-2xl mx-auto px-6 py-12">
      <div class="flex items-center gap-3 mb-8">
        <a
          [routerLink]="['/app/condominiums', condoId, 'polls']"
          [queryParams]="{ tab: 'pendentes' }"
          class="text-sm text-on-surface-variant hover:text-on-surface"
          >← Minhas votações</a
        >
      </div>

      @let s = state();
      @switch (s.kind) {
        @case ('loading') {
          <div class="flex justify-center py-12">
            <app-spinner label="Carregando…" />
          </div>
        }
        @case ('error') {
          <div class="bg-error-container text-on-error-container rounded-2xl p-6">
            <p class="text-sm">{{ s.message }}</p>
          </div>
        }
        @case ('ready') {
          <h1 class="text-2xl font-semibold text-on-surface mb-2">
            {{ s.pollDetail.poll.title }}
          </h1>
          @if (s.pollDetail.poll.description) {
            <p class="text-sm text-on-surface-variant mb-6">
              {{ s.pollDetail.poll.description }}
            </p>
          }

          @if (s.myBallots.excludedApartments.length > 0) {
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
                @for (apt of s.myBallots.excludedApartments; track apt.apartmentId) {
                  <li class="text-sm">Apto {{ apt.apartmentLabel }}</li>
                }
              </ul>
            </section>
          }

          <!-- Opções da poll (leitura — visível em todos os casos) -->
          @if (s.pollDetail.options.length > 0) {
            <section class="bg-surface-container-low rounded-2xl border border-outline-variant p-5 mb-6">
              <h2 class="text-sm font-semibold text-on-surface mb-3">Opções de voto</h2>
              <ul class="flex flex-col gap-2">
                @for (opt of s.pollDetail.options; track opt.id) {
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

          @let pending = pendingBallots();
          @let current = currentBallot();
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
                <p class="text-sm text-on-surface-variant">
                  Você já votou em todas as suas cédulas para esta votação.
                </p>
              </div>
            }
            @case ('can-vote') {
              @if (current) {
                @if (pending.length > 1) {
                  <div class="mb-4">
                    <label class="text-xs font-medium text-on-surface-variant block mb-1">
                      Apartamento ({{ pending.length }} pendentes)
                    </label>
                    <app-dropdown
                      [options]="apartmentDropdownOptions()"
                      [value]="selectedApartmentId()"
                      (valueChange)="onApartmentChange($event)"
                    />
                  </div>
                }

                <app-ballot-card
                  [apartmentLabel]="current.apartmentLabel"
                  [options]="s.pollDetail.options"
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
          }

          <app-dialog
            [open]="showBulkPrompt()"
            ariaLabelledBy="bulk-prompt-title"
            (closed)="closeBulkPrompt()"
          >
            <h2 id="bulk-prompt-title" dialog-title class="font-semibold text-on-surface mb-2">
              Aplicar a mesma opção aos {{ pendingBallots().length }} apartamentos?
            </h2>
            <p dialog-body class="text-sm text-on-surface-variant mb-4">
              Você tem {{ pendingBallots().length }} apartamentos pendentes nesta votação.
              Quer aplicar a mesma opção em todos ou votar um a um?
            </p>
            <label dialog-body class="flex items-center gap-2 text-sm text-on-surface mb-4 cursor-pointer">
              <input
                type="checkbox"
                class="accent-secondary"
                [checked]="suppressFutureChecked()"
                (change)="onSuppressChange($event)"
              />
              <span>Não perguntar novamente nesta votação</span>
            </label>
            <div dialog-actions class="flex gap-2 justify-end">
              <button
                (click)="onVoteOneByOne()"
                class="px-4 py-2 rounded-xl text-sm text-on-surface border border-outline-variant"
              >
                Votar um a um
              </button>
              <button
                (click)="onApplyBulk()"
                class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm"
              >
                Aplicar a todos
              </button>
            </div>
          </app-dialog>
          <app-success-popup
            [open]="showSuccessPopup()"
            [voteCount]="1"
            (closed)="onSuccessClosed()"
          />
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
        { kind: 'error', message: extractErrorMessage(err, 'Erro ao carregar votação.') },
      ]),
      startWith<LoadState>({ kind: 'loading' }),
    ),
    { initialValue: { kind: 'loading' } as LoadState },
  );

  protected readonly showSuccessPopup = signal(false);
  protected readonly selectedOptionId = signal<string | null>(null);
  protected readonly selectedApartmentId = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly showBulkPrompt = signal(false);
  protected readonly suppressFutureChecked = signal(false);
  protected readonly suppressBulkPromptForPoll = signal(false);
  private readonly locallyVotedApartments = signal<ReadonlySet<string>>(new Set());

  protected readonly pendingBallots = computed<ReadonlyArray<MyBallotResponse>>(() => {
    const s = this.state();
    if (s.kind !== 'ready') return [];
    const locallyVoted = this.locallyVotedApartments();
    return s.myBallots.ballots.filter(
      (b) => !b.alreadyVoted && !locallyVoted.has(b.apartmentId),
    );
  });

  protected readonly currentBallot = computed<MyBallotResponse | null>(() => {
    const pending = this.pendingBallots();
    const selectedId = this.selectedApartmentId();
    return pending.find((b) => b.apartmentId === selectedId) ?? pending[0] ?? null;
  });

  protected readonly apartmentDropdownOptions = computed<ReadonlyArray<DropdownOption<string>>>(
    () =>
      this.pendingBallots().map((b) => ({
        value: b.apartmentId,
        label: `Apto ${b.apartmentLabel}`,
      })),
  );

  protected readonly voteEligibility = computed<'not-eligible' | 'all-voted' | 'can-vote'>(() => {
    const s = this.state();
    if (s.kind !== 'ready') return 'can-vote';
    const ballots = s.myBallots.ballots;
    if (ballots.length === 0) return 'not-eligible';
    const locallyVoted = this.locallyVotedApartments();
    const allVotedNow = ballots.every(
      (b) => b.alreadyVoted || locallyVoted.has(b.apartmentId),
    );
    if (allVotedNow && ballots.every((b) => b.alreadyVoted)) return 'all-voted';
    return 'can-vote';
  });

  constructor() {
    // Sincroniza selectedApartmentId com o primeiro pendente quando muda a lista.
    effect(() => {
      const pending = this.pendingBallots();
      const selected = this.selectedApartmentId();
      if (pending.length === 0) return;
      if (!selected || !pending.some((b) => b.apartmentId === selected)) {
        this.selectedApartmentId.set(pending[0].apartmentId);
      }
    });
  }

  protected onOptionChange(optionId: string): void {
    this.selectedOptionId.set(optionId);
  }

  protected onApartmentChange(apartmentId: string): void {
    this.selectedApartmentId.set(apartmentId);
    this.selectedOptionId.set(null);
  }

  protected onSuppressChange(event: Event): void {
    this.suppressFutureChecked.set((event.target as HTMLInputElement).checked);
  }

  protected onConfirm(): void {
    const ballot = this.currentBallot();
    const optId = this.selectedOptionId();
    if (!ballot || !optId) return;
    const pendingCount = this.pendingBallots().length;
    // Múltiplos pendentes e prompt não suprimido: pergunta antes de submeter.
    // Assim "Aplicar a todos" envia os N votos via bulk; "Votar um a um" envia só o atual.
    if (pendingCount > 1 && !this.suppressBulkPromptForPoll()) {
      this.showBulkPrompt.set(true);
      return;
    }
    this.submitCurrentVote(ballot, optId);
  }

  private submitCurrentVote(ballot: MyBallotResponse, optId: string): void {
    this.submitting.set(true);
    this.submitError.set(null);
    this.api.submitVote(this.pollId, ballot.apartmentId, optId, false).subscribe({
      next: () => {
        this.submitting.set(false);
        this.locallyVotedApartments.update((set) => {
          const next = new Set(set);
          next.add(ballot.apartmentId);
          return next;
        });
        this.afterVote();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const status =
          err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : null;
        const msg =
          status === 409
            ? 'A votação foi encerrada. Volte para a lista.'
            : extractErrorMessage(err, 'Falha ao registrar voto. Tente novamente.');
        this.submitError.set(msg);
      },
    });
  }

  private afterVote(): void {
    if (this.pendingBallots().length === 0) {
      this.showSuccessPopup.set(true);
      return;
    }
    this.selectedOptionId.set(null);
  }

  protected onSuccessClosed(): void {
    this.showSuccessPopup.set(false);
    this.router.navigate(['/app/condominiums', this.condoId, 'polls'], {
      queryParams: { tab: 'pendentes' },
    });
  }

  protected closeBulkPrompt(): void {
    // ESC ou backdrop: equivale a cancelar (não submete).
    this.showBulkPrompt.set(false);
  }

  protected onVoteOneByOne(): void {
    if (this.suppressFutureChecked()) {
      this.suppressBulkPromptForPoll.set(true);
    }
    this.suppressFutureChecked.set(false);
    this.showBulkPrompt.set(false);
    // Submete apenas o voto atual (não-bulk).
    const ballot = this.currentBallot();
    const optId = this.selectedOptionId();
    if (ballot && optId) {
      this.submitCurrentVote(ballot, optId);
    }
  }

  protected onApplyBulk(): void {
    const s = this.state();
    if (s.kind !== 'ready') return;
    this.showBulkPrompt.set(false);
    this.router.navigate(
      ['/app/condominiums', this.condoId, 'polls', this.pollId, 'vote', 'review'],
      {
        state: {
          appliedOptionId: this.selectedOptionId(),
          remainingBallots: this.pendingBallots(),
          pollOptions: s.pollDetail.options,
          pollTitle: s.pollDetail.poll.title,
        },
      },
    );
  }
}
