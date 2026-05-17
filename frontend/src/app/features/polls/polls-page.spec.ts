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

const mockTenant = {
  activeCondominiumId: () => 'condo-1',
  activeRoles: () => new Set(['ADMIN']),
  isAdmin: () => true,
  isResident: () => false,
  hasActiveTenant: () => true,
  setActive: vi.fn(),
  clear: vi.fn(),
};

const mockRouter = { navigate: vi.fn(), navigateByUrl: vi.fn() };

const mockActivatedRoute = {
  snapshot: { params: { condoId: 'condo-1' } },
  params: { subscribe: vi.fn() },
  queryParams: { subscribe: vi.fn() },
};

function makePollsApi(overrides: Partial<{ list: unknown }> = {}) {
  return {
    list: vi.fn(() => of(makePageResult())),
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

async function setup(pollsApi = makePollsApi(), tenant = mockTenant) {
  await TestBed.configureTestingModule({
    imports: [PollsPage],
    providers: [
      { provide: PollsApiService, useValue: pollsApi },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
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

  it('carrega lista no init com condoId da rota', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    expect(api.list).toHaveBeenCalledWith('condo-1', undefined, 0, 10);
    expect(component.pageState()).toBe('ready');
    expect(component.polls()).toHaveLength(1);
    expect(component.totalElements()).toBe(1);
  });

  it('troca de filtro de status reseta page para 0 e recarrega', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    component.page.set(2);
    component.statusFilter.set('OPEN');
    component.page.set(0);
    component['loadPage']();
    expect(api.list).toHaveBeenLastCalledWith('condo-1', 'OPEN', 0, 10);
  });

  it('mudança de página dispara reload com nova página', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    component.onPageChange(1);
    expect(component.page()).toBe(1);
    expect(api.list).toHaveBeenLastCalledWith('condo-1', undefined, 1, 10);
  });

  it('mudança de size reseta page e dispara reload', async () => {
    const api = makePollsApi();
    const { component } = await setup(api);
    component.onSizeChange(20);
    expect(component.page()).toBe(0);
    expect(component.size()).toBe(20);
    expect(api.list).toHaveBeenLastCalledWith('condo-1', undefined, 0, 20);
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
