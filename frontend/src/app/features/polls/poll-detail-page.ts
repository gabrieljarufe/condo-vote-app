import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { extractErrorMessage } from '../../shared/http/error-message';
import {
  MyBallotsResponse,
  PollDetailResponse,
  PollOptionResponse,
  PollResponse,
  PollResultResponse,
  PollsApiService,
} from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';
import { PollStatusBadge } from './poll-status-badge';
import { PollCancelDialog } from './poll-cancel-dialog';

type PageState = 'loading' | 'error' | 'ready';

interface BreakdownRow {
  optionId: string;
  label: string;
  votes: number;
  percentage: number;
  isWinner: boolean;
}

type PollStatus = PollResponse['status'];

const QUORUM_LABELS: Record<string, string> = {
  SIMPLE_MAJORITY: 'Maioria Simples',
  ABSOLUTE_MAJORITY: 'Maioria Absoluta',
  QUALIFIED_2_3: 'Qualificado 2/3',
  QUALIFIED_3_4: 'Qualificado 3/4',
};

const CONVOCATION_LABELS: Record<string, string> = {
  FIRST: '1ª Convocação',
  SECOND: '2ª Convocação',
};

const INVALIDATION_REASON_LABELS: Record<string, string> = {
  PRESENCE_QUORUM_NOT_REACHED: 'Quórum de presença não atingido',
  NO_OPTION_REACHED_THRESHOLD: 'Nenhuma opção atingiu o limiar exigido',
};

function formatDatePtBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

@Component({
  selector: 'app-poll-detail-page',
  imports: [AppHeader, RouterLink, Spinner, PollStatusBadge, PollCancelDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-3xl mx-auto px-6 py-12">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-8">
        <a
          [routerLink]="pollsLink()"
          class="text-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Votações
        </a>
      </div>

      @if (pageState() === 'loading') {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando votação…" />
        </div>
      } @else if (pageState() === 'error') {
        <p class="text-sm text-error py-4" role="alert">{{ errorMessage() }}</p>
      } @else if (detail(); as d) {
        <div class="flex flex-col gap-6">
          <!-- Header card -->
          <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
            <div class="flex items-start justify-between gap-4 flex-wrap mb-4">
              <h1 class="text-2xl font-semibold text-on-surface">{{ d.poll.title }}</h1>
              <app-poll-status-badge [status]="d.poll.status" />
            </div>

            @if (d.poll.description) {
              <p class="text-sm text-on-surface-variant mb-4">{{ d.poll.description }}</p>
            }

            <!-- Info grid -->
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div class="flex flex-col gap-0.5">
                <dt class="text-on-surface-variant font-medium">Convocação</dt>
                <dd class="text-on-surface">{{ convocationLabel(d.poll) }}</dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt class="text-on-surface-variant font-medium">Modo de quórum</dt>
                <dd class="text-on-surface">{{ quorumLabel(d.poll) }}</dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt class="text-on-surface-variant font-medium">Início agendado</dt>
                <dd class="text-on-surface">{{ formatDate(d.poll.scheduledStart) }}</dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt class="text-on-surface-variant font-medium">Fim agendado</dt>
                <dd class="text-on-surface">{{ formatDate(d.poll.scheduledEnd) }}</dd>
              </div>
              @if (d.poll.openedAt) {
                <div class="flex flex-col gap-0.5">
                  <dt class="text-on-surface-variant font-medium">Aberta em</dt>
                  <dd class="text-on-surface">{{ formatDate(d.poll.openedAt) }}</dd>
                </div>
              }
              @if (d.poll.closedAt) {
                <div class="flex flex-col gap-0.5">
                  <dt class="text-on-surface-variant font-medium">Encerrada em</dt>
                  <dd class="text-on-surface">{{ formatDate(d.poll.closedAt) }}</dd>
                </div>
              }
              @if (d.poll.cancelledAt) {
                <div class="flex flex-col gap-0.5">
                  <dt class="text-on-surface-variant font-medium">Cancelada em</dt>
                  <dd class="text-on-surface">{{ formatDate(d.poll.cancelledAt) }}</dd>
                </div>
              }
            </dl>
          </section>

          <!-- Options -->
          <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
            <h2 class="text-base font-semibold text-on-surface mb-3">Opções de voto</h2>
            <ul class="flex flex-col gap-2">
              @for (option of sortedOptions(d.options); track option.id) {
                <li class="flex items-center gap-2 text-sm text-on-surface">
                  <span class="w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-xs font-medium text-on-surface-variant shrink-0">
                    {{ option.displayOrder }}
                  </span>
                  {{ option.label }}
                </li>
              }
            </ul>
          </section>

          <!-- Painel "Sua participação" (apenas morador) -->
          @if (isResident() && myBallots(); as mb) {
            <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
              <h2 class="text-base font-semibold text-on-surface mb-3">Sua participação</h2>
              @if (mb.ballots.length === 0 && mb.excludedApartments.length === 0) {
                <p class="text-sm text-on-surface-variant">
                  Você não tem apartamentos elegíveis nesta votação.
                </p>
              } @else {
                <ul class="flex flex-col gap-2 text-sm">
                  @for (b of mb.ballots; track b.apartmentId) {
                    <li class="flex items-center justify-between gap-3">
                      <span class="text-on-surface">Apto {{ b.apartmentLabel }}</span>
                      @if (b.alreadyVoted) {
                        <span class="text-on-surface-variant text-xs">
                          Votou em: <strong>{{ votedOptionLabel(b.votedOptionId) }}</strong>
                        </span>
                      } @else if (d.poll.status === 'OPEN') {
                        <a
                          [routerLink]="voteHref()"
                          class="text-primary text-xs underline font-medium"
                          >Votar →</a
                        >
                      } @else {
                        <span class="text-on-surface-variant text-xs">Não votou</span>
                      }
                    </li>
                  }
                  @for (apt of mb.excludedApartments; track apt.apartmentId) {
                    <li class="flex items-center justify-between gap-3 text-on-surface-variant">
                      <span>Apto {{ apt.apartmentLabel }}</span>
                      <span class="text-xs">Não elegível</span>
                    </li>
                  }
                </ul>
                @if (d.poll.status === 'OPEN' && mb.eligibleCount > 0) {
                  <!-- Apenas total elegível, sem expor participação parcial: sigilo do voto §5 -->
                  <p class="text-xs text-on-surface-variant mt-4">
                    {{ mb.eligibleCount }} apartamento(s) elegível(is) no total desta votação.
                  </p>
                }
              }
            </section>
          }

          <!-- Result (only for CLOSED / INVALIDATED) -->
          @if (d.result) {
            <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
              <h2 class="text-base font-semibold text-on-surface mb-3">Resultado</h2>
              <dl class="flex flex-col gap-3 text-sm">
                <div class="flex flex-col gap-0.5">
                  <dt class="text-on-surface-variant font-medium">Situação</dt>
                  <dd class="text-on-surface">{{ outcomeLabel(d.poll.status) }}</dd>
                </div>
                @if (d.result.invalidationReason) {
                  <div class="flex flex-col gap-0.5">
                    <dt class="text-on-surface-variant font-medium">Motivo da invalidação</dt>
                    <dd class="text-on-surface">{{ invalidationReasonLabel(d.result.invalidationReason) }}</dd>
                  </div>
                }
                <div class="flex flex-col gap-0.5">
                  <dt class="text-on-surface-variant font-medium">Total de votos</dt>
                  <dd class="text-on-surface">{{ d.result.totalVotes }}</dd>
                </div>
                @if (d.poll.status === 'CLOSED' || d.poll.status === 'INVALIDATED') {
                  <div class="mt-4">
                    <h3 class="text-sm font-medium text-on-surface mb-3">Resultado por opção</h3>
                    <ul class="flex flex-col gap-3">
                      @for (row of breakdownRows(d); track row.optionId) {
                        <li class="flex flex-col gap-1">
                          <div class="flex justify-between items-baseline">
                            <span class="text-sm text-on-surface flex items-center gap-2">
                              {{ row.label }}
                              @if (row.isWinner) {
                                <span class="text-xs bg-primary text-on-primary rounded-full px-2 py-0.5">Vencedora</span>
                              }
                            </span>
                            <span class="text-xs text-on-surface-variant tabular-nums">
                              {{ row.votes }} votos · {{ row.percentage }}%
                            </span>
                          </div>
                          <div class="h-2 rounded-full bg-surface-container-high overflow-hidden">
                            <div
                              class="h-full rounded-full transition-all"
                              [class.bg-primary]="row.isWinner"
                              [class.bg-secondary]="!row.isWinner"
                              [style.width.%]="row.percentage"
                            ></div>
                          </div>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </dl>
            </section>
          }

          <!-- Cancellation reason -->
          @if (d.poll.cancellationReason) {
            <section class="bg-error/5 rounded-2xl border border-error/20 p-6">
              <h2 class="text-base font-semibold text-error mb-2">Motivo do cancelamento</h2>
              <p class="text-sm text-on-surface">{{ d.poll.cancellationReason }}</p>
            </section>
          }

          <!-- Action error -->
          @if (actionError()) {
            <p class="text-sm text-error" role="alert">{{ actionError() }}</p>
          }

          <!-- Conditional actions (apenas síndico) -->
          @if (isAdmin() && hasActions(d.poll.status)) {
            <div class="flex flex-wrap gap-3">
              @if (d.poll.status === 'DRAFT' || d.poll.status === 'SCHEDULED') {
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-40"
                  [disabled]="actionPending()"
                  (click)="onEdit()"
                >
                  Editar
                </button>
              }
              @if (d.poll.status === 'DRAFT') {
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-white hover:opacity-90 disabled:opacity-40"
                  [disabled]="actionPending()"
                  (click)="onPublish()"
                >
                  Publicar
                </button>
              }
              @if (d.poll.status === 'SCHEDULED') {
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-white hover:opacity-90 disabled:opacity-40"
                  [disabled]="actionPending()"
                  (click)="onOpen()"
                >
                  Abrir agora
                </button>
              }
              @if (d.poll.status === 'OPEN') {
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-40"
                  [disabled]="actionPending()"
                  (click)="onClose()"
                >
                  Encerrar
                </button>
              }
              @if (d.poll.status === 'DRAFT' || d.poll.status === 'SCHEDULED' || d.poll.status === 'OPEN') {
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-medium border border-error text-error hover:bg-error/5 disabled:opacity-40"
                  [disabled]="actionPending()"
                  (click)="onCancelClick()"
                >
                  Cancelar
                </button>
              }
            </div>
          }
        </div>
      }
    </main>

    <!-- Cancel dialog -->
    <app-poll-cancel-dialog
      [open]="showCancelDialog()"
      (confirm)="onCancelConfirm($event)"
      (close)="onCancelClose()"
    >
    </app-poll-cancel-dialog>
  `,
})
export default class PollDetailPage implements OnInit {
  private readonly pollsApi = inject(PollsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenant = inject(TenantService);

  protected readonly isAdmin = computed(() => this.tenant.isAdmin());
  protected readonly isResident = computed(() => this.tenant.isResident());
  protected readonly pageState = signal<PageState>('loading');
  protected readonly detail = signal<PollDetailResponse | null>(null);
  protected readonly myBallots = signal<MyBallotsResponse | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly actionPending = signal(false);
  protected readonly actionError = signal('');
  protected readonly showCancelDialog = signal(false);
  protected readonly pollsLink = signal('');

  private condoId = '';
  private pollId = '';

  ngOnInit(): void {
    this.condoId = this.route.snapshot.params['condoId'] as string;
    this.pollId = this.route.snapshot.params['pollId'] as string;
    this.pollsLink.set(`/app/condominiums/${this.condoId}/polls`);
    this.loadDetail();
  }

  private loadDetail(): void {
    this.pageState.set('loading');
    if (this.tenant.isResident()) {
      forkJoin({
        detail: this.pollsApi.getById(this.pollId),
        ballots: this.pollsApi.getMyBallots(this.pollId),
      }).subscribe({
        next: ({ detail, ballots }) => {
          this.detail.set(detail);
          this.myBallots.set(ballots);
          this.pageState.set('ready');
        },
        error: (e: unknown) => {
          this.errorMessage.set(extractErrorMessage(e, 'Erro ao carregar votação.'));
          this.pageState.set('error');
        },
      });
      return;
    }
    this.pollsApi.getById(this.pollId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.pageState.set('ready');
      },
      error: (e: unknown) => {
        this.errorMessage.set(extractErrorMessage(e, 'Erro ao carregar votação.'));
        this.pageState.set('error');
      },
    });
  }

  protected votedOptionLabel(optionId: string | null): string {
    if (!optionId) return '—';
    const opt = this.detail()?.options.find((o) => o.id === optionId);
    return opt?.label ?? '—';
  }

  protected voteHref(): unknown[] {
    return ['/app/condominiums', this.condoId, 'polls', this.pollId, 'vote'];
  }

  protected hasActions(status: PollStatus): boolean {
    return status === 'DRAFT' || status === 'SCHEDULED' || status === 'OPEN';
  }

  protected sortedOptions(options: ReadonlyArray<PollOptionResponse>): ReadonlyArray<PollOptionResponse> {
    return [...options].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  protected convocationLabel(poll: PollResponse): string {
    return CONVOCATION_LABELS[poll.convocation] ?? poll.convocation;
  }

  protected quorumLabel(poll: PollResponse): string {
    return QUORUM_LABELS[poll.quorumMode] ?? poll.quorumMode;
  }

  protected formatDate(iso: string | null | undefined): string {
    return formatDatePtBR(iso);
  }

  protected outcomeLabel(status: PollStatus): string {
    if (status === 'CLOSED') return 'Encerrada com vencedor';
    if (status === 'INVALIDATED') return 'Invalidada';
    return status;
  }

  protected invalidationReasonLabel(reason: string | null): string {
    if (!reason) return '—';
    return INVALIDATION_REASON_LABELS[reason] ?? reason;
  }

  protected onEdit(): void {
    void this.router.navigate(['edit'], { relativeTo: this.route });
  }

  protected onPublish(): void {
    if (!window.confirm('Publicar votação?')) return;
    this.actionPending.set(true);
    this.actionError.set('');
    this.pollsApi.publish(this.pollId).subscribe({
      next: () => {
        this.actionPending.set(false);
        this.loadDetail();
      },
      error: (e: unknown) => {
        this.actionError.set(extractErrorMessage(e, 'Erro ao publicar votação.'));
        this.actionPending.set(false);
      },
    });
  }

  protected onOpen(): void {
    if (!window.confirm('Abrir votação agora?')) return;
    this.actionPending.set(true);
    this.actionError.set('');
    this.pollsApi.open(this.pollId).subscribe({
      next: () => {
        this.actionPending.set(false);
        this.loadDetail();
      },
      error: (e: unknown) => {
        const err = e instanceof HttpErrorResponse && e.status === 422
          ? 'Não há eleitores elegíveis para abrir a votação.'
          : extractErrorMessage(e, 'Erro ao abrir votação.');
        this.actionError.set(err);
        this.actionPending.set(false);
      },
    });
  }

  protected onClose(): void {
    if (!window.confirm('Encerrar votação?')) return;
    this.actionPending.set(true);
    this.actionError.set('');
    this.pollsApi.close(this.pollId).subscribe({
      next: () => {
        this.actionPending.set(false);
        this.loadDetail();
      },
      error: (e: unknown) => {
        this.actionError.set(extractErrorMessage(e, 'Erro ao encerrar votação.'));
        this.actionPending.set(false);
      },
    });
  }

  protected onCancelClick(): void {
    this.showCancelDialog.set(true);
  }

  protected onCancelConfirm(reason: string): void {
    this.actionPending.set(true);
    this.actionError.set('');
    this.pollsApi.cancel(this.pollId, { reason }).subscribe({
      next: () => {
        this.showCancelDialog.set(false);
        this.actionPending.set(false);
        this.loadDetail();
      },
      error: (e: unknown) => {
        this.actionError.set(extractErrorMessage(e, 'Erro ao cancelar votação.'));
        this.actionPending.set(false);
      },
    });
  }

  protected onCancelClose(): void {
    this.showCancelDialog.set(false);
  }

  protected breakdownRows(d: PollDetailResponse): BreakdownRow[] {
    if (!d.result) return [];
    let rawCounts: Record<string, number> = {};
    try {
      rawCounts = JSON.parse(d.result.optionsBreakdown) as Record<string, number>;
    } catch (e) {
      // optionsBreakdown vem como JSON serializado do backend (jsonb). Falha aqui
      // indica corrupção de dado ou contrato quebrado — registrar para investigação.
      // Não chamamos actionError aqui porque breakdownRows roda no template (side-effects
      // dentro de change detection geram ExpressionChangedAfterItHasBeenChecked).
      console.error('Falha ao parsear optionsBreakdown', e, d.result.optionsBreakdown);
      return [];
    }
    const total = d.result.totalVotes || 1; // evita div/0
    const rows: BreakdownRow[] = d.options.map((opt) => {
      const votes = rawCounts[opt.id] ?? 0;
      return {
        optionId: opt.id,
        label: opt.label,
        votes,
        percentage: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
        isWinner: d.result?.winningOptionId === opt.id,
      };
    });
    rows.sort((a, b) => b.votes - a.votes);
    return rows;
  }

  // Expose for tests
  protected readonly _result = (d: PollDetailResponse): PollResultResponse | null => d.result;
}
