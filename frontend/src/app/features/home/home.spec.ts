import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import Home from './home';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

describe('Home — rolesLabel', () => {
  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => {
    const mockMeApi = { getCondominiums: () => of([]) };
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: MeApiService, useValue: mockMeApi },
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compileComponents();
  });

  it('rolesLabel([ADMIN]) retorna Síndico', () => {
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).rolesLabel(['ADMIN'])).toBe('Síndico');
  });

  it('rolesLabel([OWNER]) retorna Proprietário', () => {
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).rolesLabel(['OWNER'])).toBe('Proprietário');
  });

  it('rolesLabel([TENANT]) retorna Inquilino', () => {
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).rolesLabel(['TENANT'])).toBe('Inquilino');
  });

  it('rolesLabel([ADMIN, OWNER]) retorna Síndico · Proprietário', () => {
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).rolesLabel(['ADMIN', 'OWNER'])).toBe('Síndico · Proprietário');
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

  it('chama setActive com id e roles quando há exatamente 1 condomínio', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(mockTenant.setActive).toHaveBeenCalledWith('condo-1', ['ADMIN']);
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
