import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PollResponse, PollsApiService, Page } from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import PollsPage from './polls-page';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

const mockPoll: PollResponse = {
  id: 'poll-1',
  condominiumId: 'condo-1',
  title: 'Votação de teste',
  description: null,
  convocation: 'FIRST',
  quorumMode: 'SIMPLE_MAJORITY',
  status: 'DRAFT',
  scheduledStart: '2026-06-01T10:00:00Z',
  scheduledEnd: '2026-06-01T18:00:00Z',
  openedAt: null,
  eligibleCount: null,
  closedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-05-01T00:00:00Z',
};

function makePageResult(content: PollResponse[] = [mockPoll]): Page<PollResponse> {
  return {
    content,
    page: 0,
    size: 10,
    totalElements: content.length,
    totalPages: Math.ceil(content.length / 10) || 1,
  };
}

function makeAdminTenant() {
  return {
    activeCondominiumId: () => 'condo-1',
    activeRoles: () => new Set(['ADMIN']),
    isAdmin: () => true,
    isResident: () => false,
    hasActiveTenant: () => true,
    setActive: vi.fn(),
    clear: vi.fn(),
  };
}

function makeResidentTenant() {
  return {
    activeCondominiumId: () => 'condo-1',
    activeRoles: () => new Set(['OWNER']),
    isAdmin: () => false,
    isResident: () => true,
    hasActiveTenant: () => true,
    setActive: vi.fn(),
    clear: vi.fn(),
  };
}

const mockRouter = { navigate: vi.fn().mockResolvedValue(true), navigateByUrl: vi.fn() };

function makeActivatedRoute(tab: string | null = null) {
  return {
    snapshot: {
      params: { condoId: 'condo-1' },
      queryParamMap: { get: (key: string) => (key === 'tab' ? tab : null) },
    },
    params: { subscribe: vi.fn() },
    queryParams: { subscribe: vi.fn() },
  };
}

function makePollsApi(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    list: vi.fn(() => of(makePageResult())),
    getMyPendingPolls: vi.fn(() => of([])),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    open: vi.fn(),
    cancel: vi.fn(),
    close: vi.fn(),
    getById: vi.fn(),
    ...overrides,
  };
}

async function setup(
  pollsApi: ReturnType<typeof makePollsApi> = makePollsApi(),
  tenant: ReturnType<typeof makeAdminTenant> | ReturnType<typeof makeResidentTenant> = makeAdminTenant(),
  route: ReturnType<typeof makeActivatedRoute> = makeActivatedRoute(),
) {
  mockRouter.navigate.mockClear();
  await TestBed.configureTestingModule({
    imports: [PollsPage],
    providers: [
      { provide: PollsApiService, useValue: pollsApi },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: route },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PollsPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component };
}

describe('PollsPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('admin: default tab é "em-andamento" e carrega list com status OPEN,SCHEDULED', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    expect(component.activeTab()).toBe('em-andamento');
    expect(api.list).toHaveBeenCalledWith('condo-1', ['OPEN', 'SCHEDULED'], 0, 10);
    expect(api.getMyPendingPolls).not.toHaveBeenCalled();
  });

  it('admin não vê tab "Pendentes"', async () => {
    const { component } = await setup();
    const tabs = component.visibleTabs() as Array<{ value: string }>;
    expect(tabs.map((t) => t.value)).not.toContain('pendentes');
  });

  it('morador: default tab é "pendentes" e carrega my-pending-polls', async () => {
    const api = makePollsApi({
      getMyPendingPolls: vi.fn(() =>
        of([
          {
            pollId: 'p1',
            title: 'Assembleia',
            scheduledEnd: '2026-06-01T18:00:00Z',
            pendingBallotsCount: 2,
            totalBallotsCount: 3,
          },
        ]),
      ),
    });
    const { component } = await setup(api, makeResidentTenant());
    expect(component.activeTab()).toBe('pendentes');
    expect(api.getMyPendingPolls).toHaveBeenCalledWith('condo-1');
    expect(component.pendingPolls()).toHaveLength(1);
    // pendingCount conta cédulas, não polls (1 poll × 2 cédulas pendentes).
    expect(component.pendingCount()).toBe(2);
  });

  it('queryParam tab override default', async () => {
    const { component } = await setup(makePollsApi(), makeAdminTenant(), makeActivatedRoute('encerradas'));
    expect(component.activeTab()).toBe('encerradas');
  });

  it('tab "encerradas" envia status CLOSED,INVALIDATED,CANCELLED', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    api.list.mockClear();
    component.onTabChange('encerradas');
    expect(api.list).toHaveBeenLastCalledWith(
      'condo-1',
      ['CLOSED', 'INVALIDATED', 'CANCELLED'],
      0,
      10,
    );
  });

  it('tab "todas" envia status undefined (sem filtro)', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    api.list.mockClear();
    component.onTabChange('todas');
    expect(api.list).toHaveBeenLastCalledWith('condo-1', undefined, 0, 10);
  });

  it('mudar tab navega com queryParam', async () => {
    const { component } = await setup();
    component.onTabChange('encerradas');
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'encerradas' } }),
    );
  });

  it('mudança de página dispara reload da tab ativa', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    api.list.mockClear();
    component.onPageChange(1);
    expect(component.page()).toBe(1);
    expect(api.list).toHaveBeenCalledWith('condo-1', ['OPEN', 'SCHEDULED'], 1, 10);
  });

  it('exibe mensagem de erro quando service falha', async () => {
    const api = makePollsApi({
      list: vi.fn(() => throwError(() => new Error('Falha na API'))),
    });
    const { component } = await setup(api);
    expect(component.pageState()).toBe('error');
    expect(component.errorMessage()).toBe('Falha na API');
  });
});
