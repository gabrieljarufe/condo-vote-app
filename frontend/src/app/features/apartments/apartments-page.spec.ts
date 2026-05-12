import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Apartment, ApartmentsApiService } from '../../core/api/apartments-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import ApartmentsPage from './apartments-page';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

const mockApartment: Apartment = {
  id: 'apt-1',
  condominiumId: 'condo-1',
  unitNumber: '101',
  block: 'A',
  isDelinquent: false,
  eligibleVoterUserId: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockTenant = {
  activeCondominiumId: () => 'condo-1',
  activeRoles: () => new Set(['ADMIN']),
  setActive: vi.fn(),
  clear: vi.fn(),
};

function makeApi(overrides: Partial<{ list: unknown; create: unknown; setDelinquent: unknown }> = {}) {
  return {
    list: vi.fn(() => of([mockApartment])),
    create: vi.fn(() => of({ ...mockApartment, id: 'apt-new', unitNumber: '102' })),
    setDelinquent: vi.fn(() => of({ ...mockApartment, isDelinquent: true })),
    ...overrides,
  };
}

async function setup(api = makeApi(), tenant = mockTenant) {
  await TestBed.configureTestingModule({
    imports: [ApartmentsPage],
    providers: [
      provideRouter([]),
      { provide: ApartmentsApiService, useValue: api },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ApartmentsPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component };
}

describe('ApartmentsPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza lista de apartamentos ao carregar', async () => {
    const { component } = await setup();
    expect(component.pageState()).toBe('ready');
    expect(component.apartments()).toHaveLength(1);
  });

  it('exibe estado de erro quando sem condomínio ativo', async () => {
    const noActiveTenant = { ...mockTenant, activeCondominiumId: () => null };
    const { component } = await setup(makeApi(), noActiveTenant);
    expect(component.pageState()).toBe('error');
  });

  it('exibe estado de erro quando API falha', async () => {
    const api = makeApi({ list: vi.fn(() => throwError(() => new Error('Falha'))) });
    const { component } = await setup(api);
    expect(component.pageState()).toBe('error');
    expect(component.errorMessage()).toBe('Falha');
  });

  it('onCreateApartment adiciona apartamento à lista', async () => {
    const { component } = await setup();
    component.showForm.set(true);
    component.onCreateApartment({ unitNumber: '102', block: 'A' });
    expect(component.apartments()).toHaveLength(2);
    expect(component.showForm()).toBe(false);
  });

  it('onCreateApartment com erro não altera lista', async () => {
    const api = makeApi({ create: vi.fn(() => throwError(() => new Error('Conflito'))) });
    const { component } = await setup(api);
    component.showForm.set(true);
    component.onCreateApartment({ unitNumber: '101' });
    expect(component.apartments()).toHaveLength(1);
  });

  it('onToggleDelinquent atualiza flag do apartamento', async () => {
    const { component } = await setup();
    component.onToggleDelinquent(mockApartment);
    expect(component.apartments()[0].isDelinquent).toBe(true);
  });
});
