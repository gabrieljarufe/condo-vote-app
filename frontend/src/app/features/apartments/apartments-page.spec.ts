import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Apartment, ApartmentsApiService, Page } from '../../core/api/apartments-api.service';
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
  isAdmin: () => true,
  setActive: vi.fn(),
  clear: vi.fn(),
};

const mockResidentTenant = {
  activeCondominiumId: () => 'condo-1',
  activeRoles: () => new Set(['OWNER']),
  isAdmin: () => false,
  setActive: vi.fn(),
  clear: vi.fn(),
};

function makePage(content: Apartment[], total = content.length, size = 20, page = 0): Page<Apartment> {
  return {
    content,
    page,
    size,
    totalElements: total,
    totalPages: size === 0 ? 0 : Math.ceil(total / size),
  };
}

function makeApi(overrides: Partial<{ list: unknown; create: unknown; setDelinquent: unknown }> = {}) {
  return {
    list: vi.fn(() => of(makePage([mockApartment]))),
    create: vi.fn(() => of({ ...mockApartment, id: 'apt-new', unitNumber: '102' })),
    setDelinquent: vi.fn(() => of({ ...mockApartment, isDelinquent: true })),
    ...overrides,
  };
}

const mockRouter = { navigate: vi.fn(), navigateByUrl: vi.fn() };

const mockActivatedRoute = { snapshot: {}, params: { subscribe: vi.fn() }, queryParams: { subscribe: vi.fn() } };

async function setup(api = makeApi(), tenant = mockTenant) {
  await TestBed.configureTestingModule({
    imports: [ApartmentsPage],
    providers: [
      { provide: ApartmentsApiService, useValue: api },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
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

  it('exibe estado de erro quando API falha', async () => {
    const api = makeApi({ list: vi.fn(() => throwError(() => new Error('Falha'))) });
    const { component } = await setup(api);
    expect(component.pageState()).toBe('error');
    expect(component.errorMessage()).toBe('Falha');
  });

  it('onCreateApartment re-busca a página atual após criar', async () => {
    const second = { ...mockApartment, id: 'apt-2', unitNumber: '102' };
    const api = makeApi();
    let call = 0;
    api.list = vi.fn(() => {
      call += 1;
      return of(call === 1 ? makePage([mockApartment]) : makePage([mockApartment, second]));
    });
    const { component } = await setup(api);
    component.showForm.set(true);
    component.onCreateApartment({ unitNumber: '102', block: 'A' });
    expect(api.list).toHaveBeenCalledTimes(2);
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

  it('onPageChange busca a próxima página', async () => {
    const second = { ...mockApartment, id: 'apt-2', unitNumber: '121' };
    const api = makeApi();
    let call = 0;
    api.list = vi.fn((_condo: string, page = 0, size = 20) => {
      call += 1;
      if (call === 1) return of(makePage([mockApartment], 25, size, page));
      return of(makePage([second], 25, size, page));
    });
    const { component } = await setup(api);
    component.onPageChange(1);
    expect(api.list).toHaveBeenLastCalledWith('condo-1', 1, 10);
    expect(component.apartments()[0].id).toBe('apt-2');
    expect(component.page()).toBe(1);
  });

  it('onSizeChange reseta page para 0 e re-busca', async () => {
    const api = makeApi();
    api.list = vi.fn((_condo: string, page = 0, size = 20) =>
      of(makePage([mockApartment], 25, size, page)),
    );
    const { component } = await setup(api);
    component.page.set(2);
    component.onSizeChange(10);
    expect(component.page()).toBe(0);
    expect(component.size()).toBe(10);
    expect(api.list).toHaveBeenLastCalledWith('condo-1', 0, 10);
  });

  it('expõe totalElements e totalPages a partir da resposta', async () => {
    const api = makeApi();
    api.list = vi.fn(() => of(makePage([mockApartment], 42, 20, 0)));
    const { component } = await setup(api);
    expect(component.totalElements()).toBe(42);
    expect(component.totalPages()).toBe(3);
  });

  it('onToggleDelinquent atualiza flag do apartamento', async () => {
    const { component } = await setup();
    component.onToggleDelinquent(mockApartment);
    expect(component.apartments()[0].isDelinquent).toBe(true);
  });

  it('clicar "+ Novo apartamento" mostra o chooser, não o form', async () => {
    const { fixture, component } = await setup();
    expect(component.showChooser()).toBe(false);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button[type="button"]')) as HTMLButtonElement[];
    const newBtn = buttons.find((b) => b.textContent?.includes('Novo apartamento'));
    (newBtn as HTMLButtonElement | undefined)?.click();
    fixture.detectChanges();
    expect(component.showChooser()).toBe(true);
    expect(component.showForm()).toBe(false);
  });

  it('escolher "1 apartamento" no chooser mostra o form inline', async () => {
    const { component } = await setup();
    component.showChooser.set(true);
    component.onChooseOne();
    expect(component.showChooser()).toBe(false);
    expect(component.showForm()).toBe(true);
  });

  it('escolher "vários" navega para a rota /bulk', async () => {
    const { component } = await setup();
    mockRouter.navigate.mockClear();
    component.showChooser.set(true);
    component.onChooseBulk();
    expect(component.showChooser()).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/app/condominiums',
      'condo-1',
      'apartments',
      'bulk',
    ]);
  });

  it('renderiza tabela read-only quando usuário não é admin', async () => {
    const { fixture, component } = await setup(makeApi(), mockResidentTenant);
    fixture.detectChanges();
    expect(component.isAdmin()).toBe(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text.includes('Adimplente') || text.includes('Inadimplente')).toBe(true);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button[type="button"]')) as HTMLButtonElement[];
    const newBtn = buttons.find((b) => b.textContent?.includes('Novo apartamento'));
    expect(newBtn).toBeUndefined();
  });

  it('não renderiza botões admin para morador', async () => {
    const { fixture } = await setup(makeApi(), mockResidentTenant);
    fixture.detectChanges();
    const paginator = fixture.nativeElement.querySelector('app-paginator');
    expect(paginator).toBeNull();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button[type="button"]')) as HTMLButtonElement[];
    const adminBtns = buttons.filter(
      (b) => b.textContent?.includes('Novo apartamento') || b.textContent?.includes('Inadimplente'),
    );
    expect(adminBtns).toHaveLength(0);
  });
});
