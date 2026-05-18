import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PollResponse, PollsApiService } from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Paginator } from '../../shared/ui/paginator';
import { Spinner } from '../../shared/ui/spinner';
import { PollStatusBadge } from './poll-status-badge';

type PageState = 'loading' | 'error' | 'ready';
type StatusFilter = 'ALL' | 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'INVALIDATED' | 'CANCELLED';

const CONVOCATION_LABELS: Record<string, string> = {
  FIRST: '1ª Convocação',
  SECOND: '2ª Convocação',
};

const QUORUM_LABELS: Record<string, string> = {
  SIMPLE_MAJORITY: 'Maioria Simples',
  ABSOLUTE_MAJORITY: 'Maioria Absoluta',
  QUALIFIED_2_3: 'Qualificado 2/3',
  QUALIFIED_3_4: 'Qualificado 3/4',
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'OPEN', label: 'Aberta' },
  { value: 'CLOSED', label: 'Encerrada' },
  { value: 'INVALIDATED', label: 'Invalidada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

@Component({
  selector: 'app-polls-page',
  imports: [AppHeader, Spinner, Paginator, RouterLink, PollStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-4xl mx-auto px-6 py-12">
      <div class="flex items-center gap-3 mb-8">
        <a [routerLink]="dashboardLink()" class="text-sm text-on-surface-variant hover:text-on-surface">
          ← Início
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Votações</h1>
      </div>

      @if (pageState() === 'loading') {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando votações…" />
        </div>
      } @else if (pageState() === 'error') {
        <p class="text-sm text-error py-4" role="alert">{{ errorMessage() }}</p>
      } @else {
        <div class="flex flex-col gap-6">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-2">
              <label for="status-filter" class="text-sm font-medium text-on-surface">Status</label>
              <select
                id="status-filter"
                class="px-3 py-1.5 rounded-md border border-outline-variant bg-surface text-on-surface text-sm"
                [value]="statusFilter()"
                (change)="onStatusChange($event)"
              >
                @for (opt of statusOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            @if (isAdmin()) {
              <a
                routerLink="./new"
                class="px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium hover:opacity-90"
              >
                + Nova votação
              </a>
            }
          </div>

          <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
            @if (totalElements() === 0) {
              <p class="text-sm text-on-surface-variant py-4 text-center">
                Nenhuma votação encontrada para o filtro selecionado.
              </p>
            } @else {
              <table class="w-full text-sm table-fixed">
                <thead>
                  <tr class="border-b border-outline-variant text-left text-on-surface-variant">
                    <th class="py-2 pr-4 font-medium w-2/5">Título</th>
                    <th class="py-2 pr-4 font-medium w-1/8">Status</th>
                    <th class="py-2 pr-4 font-medium w-1/6">Convocação</th>
                    <th class="py-2 pr-4 font-medium w-1/6">Quórum</th>
                    <th class="py-2 pr-2 font-medium w-1/8">Início</th>
                    <th class="py-2 font-medium w-1/8">Fim</th>
                  </tr>
                </thead>
                <tbody>
                  @for (poll of polls(); track poll.id) {
                    <tr class="border-b border-outline-variant/50 hover:bg-surface-container-low">
                      <td class="py-3 pr-4 truncate">
                        <a
                          [routerLink]="['./', poll.id]"
                          class="font-medium text-on-surface hover:text-secondary hover:underline"
                        >
                          {{ poll.title }}
                        </a>
                      </td>
                      <td class="py-3 pr-4">
                        <app-poll-status-badge [status]="poll.status" />
                      </td>
                      <td class="py-3 pr-4 text-on-surface-variant truncate">
                        {{ convocationLabel(poll) }}
                      </td>
                      <td class="py-3 pr-4 text-on-surface-variant truncate">
                        {{ quorumLabel(poll) }}
                      </td>
                      <td class="py-3 pr-2 text-on-surface-variant text-xs">
                        {{ formatDate(poll.scheduledStart) }}
                      </td>
                      <td class="py-3 text-on-surface-variant text-xs">
                        {{ formatDate(poll.scheduledEnd) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>

              <app-paginator
                [page]="page()"
                [size]="size()"
                [totalElements]="totalElements()"
                [totalPages]="totalPages()"
                (pageChange)="onPageChange($event)"
                (sizeChange)="onSizeChange($event)"
              />
            }
          </section>
        </div>
      }
    </main>
  `,
})
export default class PollsPage implements OnInit {
  private readonly pollsApi = inject(PollsApiService);
  private readonly tenant = inject(TenantService);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly polls = signal<readonly PollResponse[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly totalElements = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly isAdmin = computed(() => this.tenant.isAdmin());
  protected readonly dashboardLink = computed(() => {
    const id = this.condoId;
    return id ? `/app/condominiums/${id}` : '/app';
  });

  protected readonly statusOptions = STATUS_OPTIONS;

  private condoId = '';

  ngOnInit(): void {
    this.condoId = this.route.snapshot.params['condoId'] as string;
    this.loadPage();
  }

  private loadPage(): void {
    this.pageState.set('loading');
    const filter = this.statusFilter();
    const status = filter === 'ALL' ? undefined : filter;
    this.pollsApi.list(this.condoId, status, this.page(), this.size()).subscribe({
      next: (data) => {
        this.polls.set([...data.content]);
        this.totalElements.set(data.totalElements);
        this.totalPages.set(data.totalPages);
        this.pageState.set('ready');
      },
      error: (e: unknown) => {
        this.errorMessage.set(e instanceof Error ? e.message : 'Erro ao carregar votações.');
        this.pageState.set('error');
      },
    });
  }

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as StatusFilter;
    this.statusFilter.set(value);
    this.page.set(0);
    this.loadPage();
  }

  protected onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.loadPage();
  }

  protected onSizeChange(newSize: number): void {
    this.size.set(newSize);
    this.page.set(0);
    this.loadPage();
  }

  protected convocationLabel(poll: PollResponse): string {
    return CONVOCATION_LABELS[poll.convocation] ?? poll.convocation;
  }

  protected quorumLabel(poll: PollResponse): string {
    return QUORUM_LABELS[poll.quorumMode] ?? poll.quorumMode;
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }
}
