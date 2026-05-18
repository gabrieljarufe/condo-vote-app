import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { MeApiService } from '../../core/api/me-api.service';
import { PollsApiService } from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import CondominiumDashboard from './condominium-dashboard';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {
  @Input() condominiums: unknown[] = [];
}

@Component({ selector: 'app-spinner', template: '', standalone: true })
class SpinnerStub {}

function makeCondosList() {
  return [{ id: 'condo-1', name: 'Condo Test', role: 'OWNER' as const }];
}

function makeMeApi() {
  return {
    getCondominiums: vi.fn(() => of(makeCondosList())),
    getMe: vi.fn(),
  };
}

function makePollsApi(pendingCount = 3) {
  return {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    open: vi.fn(),
    cancel: vi.fn(),
    close: vi.fn(),
    getById: vi.fn(),
    getMyBallots: vi.fn(),
    submitVote: vi.fn(),
    getMyPendingPolls: vi.fn(() =>
      of(
        Array.from({ length: pendingCount }, (_, i) => ({
          pollId: `poll-${i}`,
          title: `Votação ${i}`,
          scheduledEnd: '2026-06-01T18:00:00Z',
          pendingBallotsCount: 1,
          totalBallotsCount: 5,
        })),
      ),
    ),
  };
}

function makeTenant(roles: string[]) {
  const roleSet = new Set(roles);
  return {
    activeCondominiumId: vi.fn(() => 'condo-1'),
    activeRoles: vi.fn(() => roleSet),
    isAdmin: vi.fn(() => roleSet.has('ADMIN')),
    isResident: vi.fn(() => roleSet.has('OWNER') || roleSet.has('TENANT')),
    hasActiveTenant: vi.fn(() => true),
    setActive: vi.fn(),
    clear: vi.fn(),
  };
}

async function setup(
  roles: string[] = ['OWNER'],
  pendingCount = 3,
) {
  const meApi = makeMeApi();
  const pollsApi = makePollsApi(pendingCount);
  const tenant = makeTenant(roles);

  await TestBed.configureTestingModule({
    imports: [CondominiumDashboard],
    providers: [
      { provide: MeApiService, useValue: meApi },
      { provide: PollsApiService, useValue: pollsApi },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
    ],
  })
    .overrideComponent(CondominiumDashboard, {
      set: { imports: [AppHeaderStub, SpinnerStub] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(CondominiumDashboard);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, meApi, pollsApi };
}

describe('CondominiumDashboard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('morador vê card único "Votações" com subtítulo de pendências', async () => {
    const { fixture, component } = await setup(['OWNER'], 2);
    expect(component.isResident()).toBe(true);
    expect(component.pollsSubtitle()).toBe('2 pendentes');
    const el: HTMLElement = fixture.nativeElement;
    // Apenas 1 card "Votações" (não dois como antes)
    const votacoesCards = Array.from(el.querySelectorAll('a')).filter((a) =>
      a.textContent?.includes('Votações'),
    );
    expect(votacoesCards).toHaveLength(1);
    // Não deve haver mais "Minhas votações" nem "Todas as votações"
    expect(el.textContent).not.toContain('Minhas votações');
    expect(el.textContent).not.toContain('Todas as votações');
  });

  it('admin vê card "Votações" com subtítulo de gestão', async () => {
    const { component } = await setup(['ADMIN']);
    expect(component.isResident()).toBe(false);
    expect(component.pollsSubtitle()).toContain('gerencie');
  });

  it('badge de pendências aparece apenas para resident com count > 0', async () => {
    const { fixture: r3 } = await setup(['OWNER'], 3);
    expect((r3.nativeElement as HTMLElement).textContent).toContain('3');
    TestBed.resetTestingModule();
    const { fixture: r0 } = await setup(['OWNER'], 0);
    const el: HTMLElement = r0.nativeElement;
    // Sem pendências, subtítulo neutro
    expect(el.textContent).toContain('Acompanhe e participe');
  });

  it('subtítulo singular "1 pendente" para 1 pendência', async () => {
    const { component } = await setup(['OWNER'], 1);
    expect(component.pollsSubtitle()).toBe('1 pendente');
  });

  it('isAdmin é true apenas quando tem role ADMIN', async () => {
    const { component } = await setup(['ADMIN']);
    expect(component.isAdmin()).toBe(true);
  });

  it('condoId vem do tenant service', async () => {
    const { component } = await setup(['OWNER']);
    expect(component.condoId()).toBe('condo-1');
  });
});
