import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import Home from './home';
import { rolesLabel } from './home-utils';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

describe('Home — rolesLabel', () => {
  it('rolesLabel([ADMIN]) retorna Síndico', () => {
    expect(rolesLabel(['ADMIN'])).toBe('Síndico');
  });

  it('rolesLabel([OWNER]) retorna Proprietário', () => {
    expect(rolesLabel(['OWNER'])).toBe('Proprietário');
  });

  it('rolesLabel([TENANT]) retorna Inquilino', () => {
    expect(rolesLabel(['TENANT'])).toBe('Inquilino');
  });

  it('rolesLabel([ADMIN, OWNER]) retorna Síndico · Proprietário', () => {
    expect(rolesLabel(['ADMIN', 'OWNER'])).toBe('Síndico · Proprietário');
  });
});

describe('Home — auto-seleção de condomínio único', () => {
  afterEach(() => TestBed.resetTestingModule());

  const condo: UserCondominium = { id: 'condo-1', name: 'Edifício Teste', roles: ['ADMIN'] };
  let mockTenant: { activeCondominiumId: () => null; activeRoles: () => Set<never>; setActive: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockTenant = {
      activeCondominiumId: () => null,
      activeRoles: () => new Set(),
      setActive: vi.fn(),
      clear: vi.fn(),
    };
    const mockMeApi = { getCondominiums: () => of([condo]) };
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: MeApiService, useValue: mockMeApi },
        { provide: TenantService, useValue: mockTenant },
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compileComponents();
  });

  it('chama setActive e navega para /app/condominiums/:id quando há exatamente 1 condomínio', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(mockTenant.setActive).toHaveBeenCalledWith('condo-1', ['ADMIN']);
    expect(navigateSpy).toHaveBeenCalledWith(['/app/condominiums', 'condo-1']);
  });
});

describe('Home — selectCondo', () => {
  afterEach(() => TestBed.resetTestingModule());

  const condos: UserCondominium[] = [
    { id: 'condo-1', name: 'Pitufos', roles: ['ADMIN'] },
    { id: 'condo-2', name: 'Smurfs', roles: ['OWNER'] },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: MeApiService, useValue: { getCondominiums: () => of(condos) } },
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compileComponents();
  });

  it('chama setActive e navega para /app/condominiums/:id ao selecionar', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const tenant = TestBed.inject(TenantService);
    const setActiveSpy = vi.spyOn(tenant, 'setActive');

    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fixture.componentInstance as any).selectCondo(condos[0]);

    expect(setActiveSpy).toHaveBeenCalledWith('condo-1', ['ADMIN']);
    expect(navigateSpy).toHaveBeenCalledWith(['/app/condominiums', 'condo-1']);
  });
});

describe('Home — estado de erro', () => {
  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    const mockMeApi = { getCondominiums: () => throwError(() => new Error('Erro de rede')) };
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: MeApiService, useValue: mockMeApi },
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compileComponents();
  });

  it('exibe mensagem de erro quando getCondominiums falha', () => {
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).errorMessage()).toBe('Erro de rede');
  });
});
