import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { MeApiService } from '../../core/api/me-api.service';
import { PollsApiService } from '../../core/api/polls-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';
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

async function setup(roles: string[] = ['OWNER'], pendingCount = 3) {
  const meApi = makeMeApi();
  const pollsApi = makePollsApi(pendingCount);
  const tenant = makeTenant(roles);

  await TestBed.configureTestingModule({
    imports: [CondominiumDashboard],
    providers: [
      provideRouter([]),
      { provide: MeApiService, useValue: meApi },
      { provide: PollsApiService, useValue: pollsApi },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
    ],
  })
    .overrideComponent(CondominiumDashboard, {
      remove: { imports: [AppHeader, Spinner] },
      add: { imports: [AppHeaderStub, SpinnerStub] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(CondominiumDashboard);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, meApi, pollsApi };
}

function findCardByTitle(el: HTMLElement, title: string): HTMLAnchorElement | null {
  return (
    Array.from(el.querySelectorAll('a')).find((a) => {
      const t = a.querySelector('p.font-semibold')?.textContent?.trim();
      return t === title;
    }) ?? null
  );
}

describe('CondominiumDashboard', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('layout plano (papel único)', () => {
    it('OWNER puro: sem h2 de seção, sem card Convites, sem card Criar votação', async () => {
      const { fixture, component } = await setup(['OWNER'], 0);
      expect(component.isHybrid()).toBe(false);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('section[aria-labelledby]')).toBeNull();
      expect(findCardByTitle(el, 'Convites')).toBeNull();
      expect(findCardByTitle(el, 'Criar votação')).toBeNull();
      const apt = findCardByTitle(el, 'Apartamentos');
      expect(apt?.textContent).toContain('Acesse o seu apartamento');
      expect(el.textContent).toContain('Acompanhe e participe');
    });

    it('ADMIN puro: sem h2, com Convites, sem badge de pendentes, subtítulo de gestão em Votações', async () => {
      const { fixture, component } = await setup(['ADMIN'], 0);
      expect(component.isHybrid()).toBe(false);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('section[aria-labelledby]')).toBeNull();
      expect(findCardByTitle(el, 'Convites')).toBeTruthy();
      expect(findCardByTitle(el, 'Criar votação')).toBeNull();
      const apt = findCardByTitle(el, 'Apartamentos');
      expect(apt?.textContent).toContain('Gerencie unidades e inadimplência');
      const polls = findCardByTitle(el, 'Votações');
      expect(polls?.textContent).toContain('Crie e gerencie');
      expect(polls?.querySelector('[aria-label$="de voto"]')).toBeNull();
    });
  });

  describe('layout híbrido (ADMIN + OWNER)', () => {
    it('com 0 cédulas pendentes: ordem Gerenciar → Participar', async () => {
      const { fixture, component } = await setup(['ADMIN', 'OWNER'], 0);
      expect(component.isHybrid()).toBe(true);
      const el: HTMLElement = fixture.nativeElement;
      const sections = Array.from(el.querySelectorAll('section[aria-labelledby]'));
      expect(sections).toHaveLength(2);
      expect(sections[0].getAttribute('aria-labelledby')).toBe('manage-heading');
      expect(sections[1].getAttribute('aria-labelledby')).toBe('participate-heading');
      expect(el.querySelector('#manage-heading')?.textContent?.trim()).toBe('Gerenciar');
      expect(el.querySelector('#participate-heading')?.textContent?.trim()).toBe('Participar');
      expect(findCardByTitle(el, 'Criar votação')).toBeTruthy();
      expect(findCardByTitle(el, 'Convites')).toBeTruthy();
    });

    it('com 3 cédulas pendentes: ordem invertida (Participar primeiro) e badge com aria-label', async () => {
      const { fixture, component } = await setup(['ADMIN', 'OWNER'], 3);
      expect(component.isHybrid()).toBe(true);
      const el: HTMLElement = fixture.nativeElement;
      const sections = Array.from(el.querySelectorAll('section[aria-labelledby]'));
      expect(sections[0].getAttribute('aria-labelledby')).toBe('participate-heading');
      expect(sections[1].getAttribute('aria-labelledby')).toBe('manage-heading');

      const polls = findCardByTitle(el, 'Votações');
      const badge = polls?.querySelector('[aria-label]');
      expect(badge?.getAttribute('aria-label')).toBe('3 cédulas pendentes de voto');
      expect(badge?.textContent?.trim()).toBe('3');
      expect(polls?.textContent).toContain('3 cédulas pendentes');

      const participate = sections.find(
        (s) => s.getAttribute('aria-labelledby') === 'participate-heading',
      ) as HTMLElement;
      const aptParticipate = findCardByTitle(participate, 'Apartamentos');
      expect(aptParticipate?.textContent).toContain('Acesse o seu apartamento');

      const manage = sections.find(
        (s) => s.getAttribute('aria-labelledby') === 'manage-heading',
      ) as HTMLElement;
      const aptManage = findCardByTitle(manage, 'Apartamentos');
      expect(aptManage?.textContent).toContain('Gerencie unidades e inadimplência');
    });

    it('aria-label singular para 1 cédula', async () => {
      const { fixture } = await setup(['ADMIN', 'OWNER'], 1);
      const el: HTMLElement = fixture.nativeElement;
      const polls = findCardByTitle(el, 'Votações');
      const badge = polls?.querySelector('[aria-label]');
      expect(badge?.getAttribute('aria-label')).toBe('1 cédula pendente de voto');
    });
  });

  describe('regressão de comportamento', () => {
    it('condoId vem do tenant service', async () => {
      const { component } = await setup(['OWNER']);
      expect(component.condoId()).toBe('condo-1');
    });

    it('heading order: h1 do nome do condo precede qualquer h2', async () => {
      const { fixture } = await setup(['ADMIN', 'OWNER'], 0);
      const el: HTMLElement = fixture.nativeElement;
      const headings = Array.from(el.querySelectorAll('h1, h2'));
      expect(headings[0].tagName).toBe('H1');
      expect(headings.slice(1).every((h) => h.tagName === 'H2')).toBe(true);
    });
  });
});
