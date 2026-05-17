import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from, mergeMap, of, catchError, map } from 'rxjs';
import {
  MyBallotResponse,
  PollOptionResponse,
  PollsApiService,
} from '../../../core/api/polls-api.service';
import { AppHeader } from '../../../shared/layout/app-header';
import { BallotCard } from './ballot-card';

interface ReviewState {
  appliedOptionId: string;
  remainingBallots: ReadonlyArray<MyBallotResponse>;
  pollOptions: ReadonlyArray<PollOptionResponse>;
  pollTitle: string;
}

interface BallotRow {
  ballot: MyBallotResponse;
  optionId: string;
}

interface SubmitResultRow {
  apartmentId: string;
  apartmentLabel: string;
  success: boolean;
  errorMessage?: string;
}

@Component({
  selector: 'app-ballot-review-page',
  imports: [CommonModule, AppHeader, BallotCard, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-2xl mx-auto px-6 py-12">
      @if (!stateData()) {
        <p class="text-sm text-on-surface-variant">Redirecionando…</p>
      } @else {
        <h1 class="text-2xl font-semibold text-on-surface mb-2">{{ stateData()!.pollTitle }}</h1>
        <p class="text-sm text-on-surface-variant mb-6">
          Revise as cédulas restantes. Toque numa cédula para alterar a opção.
        </p>

        @if (!hasResults()) {
          <div class="space-y-3 mb-6">
            @for (row of rows(); track row.ballot.apartmentId) {
              <app-ballot-card
                [apartmentLabel]="row.ballot.apartmentLabel"
                [options]="stateData()!.pollOptions"
                [selectedOptionId]="row.optionId"
                [radioGroupName]="'review-' + row.ballot.apartmentId"
                (optionChange)="onOverride(row.ballot.apartmentId, $event)"
              />
            }
          </div>

          <button
            class="w-full bg-primary text-on-primary rounded-2xl py-3 font-semibold disabled:opacity-50"
            [disabled]="submitting()"
            (click)="onConfirmAll()"
          >
            {{ submitting() ? 'Enviando…' : 'Confirmar ' + rows().length + ' votos' }}
          </button>
        } @else {
          <!-- Resultado pós-submit -->
          <div class="bg-surface-container-low rounded-2xl border border-outline-variant p-6 mb-6">
            <p class="text-sm">
              Sucessos: <strong>{{ successCount() }}</strong> · Falhas: <strong>{{ failureCount() }}</strong>
            </p>
            <ul class="mt-4 space-y-2">
              @for (r of submitResults(); track r.apartmentId) {
                <li class="text-xs flex justify-between">
                  <span>{{ r.apartmentLabel }}</span>
                  @if (r.success) {
                    <span class="text-primary">✓ Registrado</span>
                  } @else {
                    <span class="text-error">{{ r.errorMessage }}</span>
                  }
                </li>
              }
            </ul>
          </div>

          <div class="flex gap-2">
            @if (failureCount() > 0) {
              <button (click)="onRetryFailed()" class="px-4 py-2 rounded-xl border border-outline-variant text-sm">
                Tentar novamente nas falhas
              </button>
            }
            <button (click)="backToList()" class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm">
              Voltar à lista
            </button>
          </div>
        }
      }
    </main>
  `,
})
export default class BallotReviewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PollsApiService);

  protected readonly condoId = this.route.snapshot.paramMap.get('condoId') ?? '';
  protected readonly pollId = this.route.snapshot.paramMap.get('pollId') ?? '';

  protected readonly stateData = signal<ReviewState | null>(null);
  protected readonly rows = signal<ReadonlyArray<BallotRow>>([]);
  protected readonly submitting = signal(false);
  protected readonly submitResults = signal<ReadonlyArray<SubmitResultRow>>([]);

  protected readonly hasResults = computed(() => this.submitResults().length > 0);
  protected readonly successCount = computed(() => this.submitResults().filter((r) => r.success).length);
  protected readonly failureCount = computed(() => this.submitResults().filter((r) => !r.success).length);

  constructor() {
    const nav = this.router.getCurrentNavigation();
    const state = (nav?.extras?.state ?? history.state) as ReviewState | undefined;
    if (!state?.appliedOptionId || !state?.remainingBallots?.length) {
      this.router.navigate(['/app/condominiums', this.condoId, 'polls', this.pollId, 'vote']);
      return;
    }
    this.stateData.set(state);
    this.rows.set(state.remainingBallots.map((b) => ({ ballot: b, optionId: state.appliedOptionId })));
  }

  protected onOverride(apartmentId: string, newOptionId: string): void {
    this.rows.set(
      this.rows().map((r) =>
        r.ballot.apartmentId === apartmentId ? { ...r, optionId: newOptionId } : r,
      ),
    );
  }

  protected onConfirmAll(): void {
    const rows = this.rows();
    this.submitting.set(true);
    const results: SubmitResultRow[] = [];

    from(rows)
      .pipe(
        mergeMap((row) =>
          this.api.submitVote(this.pollId, row.ballot.apartmentId, row.optionId, true).pipe(
            map(
              () =>
                ({
                  apartmentId: row.ballot.apartmentId,
                  apartmentLabel: row.ballot.apartmentLabel,
                  success: true,
                }) as SubmitResultRow,
            ),
            catchError((err) =>
              of({
                apartmentId: row.ballot.apartmentId,
                apartmentLabel: row.ballot.apartmentLabel,
                success: false,
                errorMessage:
                  err?.status === 409
                    ? 'Votação encerrada/duplicada'
                    : 'Falha ao registrar',
              } as SubmitResultRow),
            ),
          ),
        ),
      )
      .subscribe({
        next: (r) => results.push(r),
        complete: () => {
          this.submitting.set(false);
          this.submitResults.set(results);
        },
      });
  }

  protected onRetryFailed(): void {
    const failed = this.submitResults().filter((r) => !r.success);
    const remainingRows = this.rows().filter((row) =>
      failed.some((f) => f.apartmentId === row.ballot.apartmentId),
    );
    this.rows.set(remainingRows);
    this.submitResults.set([]);
    this.onConfirmAll();
  }

  protected backToList(): void {
    this.router.navigate(['/app/condominiums', this.condoId, 'my-polls']);
  }
}
