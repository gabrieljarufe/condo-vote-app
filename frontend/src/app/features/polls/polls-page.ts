import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  MyPendingPollResponse,
  PollResponse,
  PollsApiService,
} from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Paginator } from '../../shared/ui/paginator';
import { Spinner } from '../../shared/ui/spinner';
import { PollStatusBadge } from './poll-status-badge';

type PageState = 'loading' | 'error' | 'ready';
type Tab = 'pendentes' | 'em-andamento' | 'encerradas' | 'todas';

interface TabConfig {
  readonly value: Tab;
  readonly label: string;
  // Quando vazio = "todas" (sem filtro). Quando 'pendentes' = caminho especial (my-pending-polls).
  readonly statuses: ReadonlyArray<PollResponse['status']>;
}

const TAB_CONFIGS: ReadonlyArray<TabConfig> = [
  { value: 'pendentes', label: 'Pendentes', statuses: [] },
  { value: 'em-andamento', label: 'Em andamento', statuses: ['OPEN', 'SCHEDULED'] },
  { value: 'encerradas', label: 'Encerradas', statuses: ['CLOSED', 'INVALIDATED', 'CANCELLED'] },
  { value: 'todas', label: 'Todas', statuses: [] },
];

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

      <div class="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Filtros de votação">
          @for (tab of visibleTabs(); track tab.value) {
            <button
              role="tab"
              [attr.aria-selected]="tab.value === activeTab()"
              [class]="
                'px-4 py-1.5 rounded-full text-sm font-medium transition ' +
                (tab.value === activeTab()
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')
              "
              (click)="onTabChange(tab.value)"
            >
              {{ tab.label }}
              @if (tab.value === 'pendentes' && pendingCount() > 0) {
                <span class="ml-1 text-xs">({{ pendingCount() }})</span>
              }
            </button>
          }
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

      @if (pageState() === 'loading') {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando votações…" />
        </div>
      } @else if (pageState() === 'error') {
        <p class="text-sm text-error py-4" role="alert">{{ errorMessage() }}</p>
      } @else {
        @if (activeTab() === 'pendentes') {
          @if (pendingPolls().length === 0) {
            <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
              <p class="text-sm text-on-surface-variant py-4 text-center">
                Você não tem votações pendentes.
                <a
                  (click)="onTabChange('em-andamento')"
                  class="text-primary underline cursor-pointer ml-1"
                  >Ver em andamento</a
                >
              </p>
            </section>
          } @else {
            <section class="flex flex-col gap-3">
              @for (p of pendingPolls(); track p.pollId) {
                <article
                  class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 flex items-center justify-between gap-4"
                >
                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-on-surface truncate">{{ p.title }}</h3>
                    <p class="text-xs text-on-surface-variant mt-1">
                      {{ p.pendingBallotsCount }} de {{ p.totalBallotsCount }} cédula(s) pendente(s)
                      · encerra {{ formatDate(p.scheduledEnd) }}
                    </p>
                  </div>
                  <a
                    [routerLink]="['/app/condominiums', condoId, 'polls', p.pollId, 'vote']"
                    class="shrink-0 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold"
                  >
                    Votar →
                  </a>
                </article>
              }
            </section>
          }
        } @else {
          <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
            @if (totalElements() === 0) {
              <p class="text-sm text-on-surface-variant py-4 text-center">
                {{ emptyMessage() }}
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
        }
      }
    </main>
  `,
})
export default class PollsPage implements OnInit {
  private readonly pollsApi = inject(PollsApiService);
  private readonly tenant = inject(TenantService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly polls = signal<readonly PollResponse[]>([]);
  protected readonly pendingPolls = signal<readonly MyPendingPollResponse[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly totalElements = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly activeTab = signal<Tab>('em-andamento');
  protected readonly pendingCount = computed(() => this.pendingPolls().length);
  protected readonly isAdmin = computed(() => this.tenant.isAdmin());
  protected readonly isResident = computed(() => this.tenant.isResident());

  // Admin puro (sem papel de morador) não vê a tab "Pendentes".
  protected readonly visibleTabs = computed<ReadonlyArray<TabConfig>>(() => {
    return this.isResident()
      ? TAB_CONFIGS
      : TAB_CONFIGS.filter((t) => t.value !== 'pendentes');
  });

  protected readonly dashboardLink = computed(() => {
    const id = this.condoId;
    return id ? `/app/condominiums/${id}` : '/app';
  });

  protected condoId = '';

  ngOnInit(): void {
    this.condoId = this.route.snapshot.params['condoId'] as string;
    const tabParam = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    const initial = tabParam ?? this.defaultTab();
    this.activeTab.set(initial);
    // Sempre carrega contagem de pendentes (para o badge visível em qualquer tab).
    if (this.isResident()) {
      this.pollsApi.getMyPendingPolls(this.condoId).subscribe({
        next: (list) => this.pendingPolls.set(list),
        error: () => this.pendingPolls.set([]),
      });
    }
    this.loadForTab(initial);
  }

  private defaultTab(): Tab {
    return this.isResident() ? 'pendentes' : 'em-andamento';
  }

  protected emptyMessage(): string {
    switch (this.activeTab()) {
      case 'em-andamento':
        return 'Nenhuma votação em andamento.';
      case 'encerradas':
        return 'Nenhuma votação encerrada ainda.';
      case 'todas':
      default:
        return 'Nenhuma votação encontrada.';
    }
  }

  private loadForTab(tab: Tab): void {
    this.pageState.set('loading');
    if (tab === 'pendentes') {
      // pendingPolls já carregado em ngOnInit; só reaproveita.
      this.pageState.set('ready');
      return;
    }
    const cfg = TAB_CONFIGS.find((t) => t.value === tab);
    const status = cfg && cfg.statuses.length > 0 ? cfg.statuses : undefined;
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

  protected onTabChange(tab: Tab): void {
    this.activeTab.set(tab);
    this.page.set(0);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
    this.loadForTab(tab);
  }

  protected onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.loadForTab(this.activeTab());
  }

  protected onSizeChange(newSize: number): void {
    this.size.set(newSize);
    this.page.set(0);
    this.loadForTab(this.activeTab());
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
