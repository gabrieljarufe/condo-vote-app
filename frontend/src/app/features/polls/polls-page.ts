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
import { Spinner } from '../../shared/ui/spinner';
import { PendingPollsList } from './pending-polls-list';
import { PollsTable } from './polls-table';

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

@Component({
  selector: 'app-polls-page',
  imports: [AppHeader, Spinner, RouterLink, PendingPollsList, PollsTable],
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
      } @else if (activeTab() === 'pendentes') {
        <app-pending-polls-list
          [polls]="pendingPolls()"
          [condoId]="condoId"
          (seeInProgress)="onTabChange('em-andamento')"
        />
      } @else {
        <app-polls-table
          [polls]="polls()"
          [page]="page()"
          [size]="size()"
          [totalElements]="totalElements()"
          [totalPages]="totalPages()"
          [emptyMessage]="emptyMessage()"
          (pageChange)="onPageChange($event)"
          (sizeChange)="onSizeChange($event)"
        />
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
  // Conta cédulas, não polls — mesma semântica do dashboard.
  protected readonly pendingCount = computed(() =>
    this.pendingPolls().reduce((acc, p) => acc + p.pendingBallotsCount, 0),
  );
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
    // Quando a tab inicial não é "pendentes", priming do badge com a contagem atual.
    // (Se for "pendentes", o loadForTab abaixo já busca.)
    if (this.isResident() && initial !== 'pendentes') {
      this.refreshPendingPolls();
    }
    this.loadForTab(initial);
  }

  private refreshPendingPolls(): void {
    this.pollsApi.getMyPendingPolls(this.condoId).subscribe({
      next: (list) => this.pendingPolls.set(list),
      error: () => this.pendingPolls.set([]),
    });
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
      // Re-busca sempre que a tab é ativada — evita lista stale após votar
      // em outra aba ou voltar da página de voto.
      this.pollsApi.getMyPendingPolls(this.condoId).subscribe({
        next: (list) => {
          this.pendingPolls.set(list);
          this.pageState.set('ready');
        },
        error: (e: unknown) => {
          this.errorMessage.set(e instanceof Error ? e.message : 'Erro ao carregar pendências.');
          this.pageState.set('error');
        },
      });
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
}
