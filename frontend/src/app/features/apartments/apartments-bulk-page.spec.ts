import { Component, output, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApartmentsApiService, BatchCreateResponse } from '../../core/api/apartments-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import ApartmentsBulkPage from './apartments-bulk-page';
import { GeneratedApartment } from './generate-apartments';

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {}

@Component({ selector: 'app-apartment-bulk-generator-form', template: '', standalone: true })
class GeneratorFormStub {
  readonly generate = output<GeneratedApartment[]>();
}

@Component({ selector: 'app-apartment-bulk-preview-grid', template: '', standalone: true })
class PreviewGridStub {
  readonly apartments = input<GeneratedApartment[]>([]);
  readonly disabled = input<boolean>(false);
  readonly back = output<void>();
  readonly cancel = output<void>();
  readonly submitBatch = output<GeneratedApartment[]>();
}

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

const mockTenant = {
  activeCondominiumId: () => 'condo-1',
  activeRoles: () => new Set(['ADMIN']),
  setActive: vi.fn(),
  clear: vi.fn(),
};

const mockRouter = { navigate: vi.fn(), navigateByUrl: vi.fn() };

const mockActivatedRoute = {
  snapshot: {},
  params: { subscribe: vi.fn() },
  queryParams: { subscribe: vi.fn() },
};

const sampleApartments: GeneratedApartment[] = [
  { block: 'A', unitNumber: '101', floor: 1, seq: 1 },
  { block: 'A', unitNumber: '102', floor: 1, seq: 2 },
];

const successResponse: BatchCreateResponse = {
  created: [
    {
      id: 'apt-1',
      condominiumId: 'condo-1',
      unitNumber: '101',
      block: 'A',
      isDelinquent: false,
      eligibleVoterUserId: null,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'apt-2',
      condominiumId: 'condo-1',
      unitNumber: '102',
      block: 'A',
      isDelinquent: false,
      eligibleVoterUserId: null,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  skipped: [],
};

const partialResponse: BatchCreateResponse = {
  created: [
    {
      id: 'apt-1',
      condominiumId: 'condo-1',
      unitNumber: '101',
      block: 'A',
      isDelinquent: false,
      eligibleVoterUserId: null,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  skipped: [{ unitNumber: '102', block: 'A', reason: 'DUPLICATE' }],
};

function makeApi(
  overrides: Partial<{ createBatch: unknown }> = {},
) {
  return {
    list: vi.fn(() => of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })),
    create: vi.fn(() => of({})),
    createBatch: vi.fn(() => of(successResponse)),
    setDelinquent: vi.fn(() => of({})),
    ...overrides,
  };
}

async function setup(api = makeApi(), tenant = mockTenant) {
  await TestBed.configureTestingModule({
    imports: [ApartmentsBulkPage],
    providers: [
      { provide: ApartmentsApiService, useValue: api },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
    ],
  })
    .overrideComponent(ApartmentsBulkPage, {
      set: {
        imports: [AppHeaderStub, RouterLink, GeneratorFormStub, PreviewGridStub],
      },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(ApartmentsBulkPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component };
}

describe('ApartmentsBulkPage', () => {
  beforeEach(() => {
    mockRouter.navigate.mockClear();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('exibe Step 1 (GeneratorForm) por padrão', async () => {
    const { component } = await setup();
    expect(component.step()).toBe('pattern');
    expect(component.generatedApartments()).toEqual([]);
  });

  it('onGenerate transiciona para Step 2 com os apartamentos gerados', async () => {
    const { component } = await setup();
    component.onGenerate(sampleApartments);
    expect(component.step()).toBe('preview');
    expect(component.generatedApartments()).toEqual(sampleApartments);
  });

  it('back emitido pelo grid volta para Step 1', async () => {
    const { component } = await setup();
    component.step.set('preview');
    component.step.set('pattern');
    expect(component.step()).toBe('pattern');
  });

  it('cancel navega para a rota de apartamentos', async () => {
    const { component } = await setup();
    component.navigateToApartments();
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/app/condominiums',
      'condo-1',
      'apartments',
    ]);
  });

  it('onSubmitBatch chama createBatch com os items mapeados corretamente', async () => {
    const api = makeApi();
    const { component } = await setup(api);
    component.onSubmitBatch(sampleApartments);
    expect(api.createBatch).toHaveBeenCalledWith('condo-1', {
      items: [
        { unitNumber: '101', block: 'A' },
        { unitNumber: '102', block: 'A' },
      ],
    });
  });

  it('sucesso sem skipped → batchStatus "success" e batchResult preenchido', async () => {
    const api = makeApi({ createBatch: vi.fn(() => of(successResponse)) });
    const { component } = await setup(api);
    component.onSubmitBatch(sampleApartments);
    expect(component.batchStatus()).toBe('success');
    expect(component.batchResult()).toEqual(successResponse);
  });

  it('sucesso com skipped → batchStatus "partial" com contagem correta', async () => {
    const api = makeApi({ createBatch: vi.fn(() => of(partialResponse)) });
    const { component } = await setup(api);
    component.onSubmitBatch(sampleApartments);
    expect(component.batchStatus()).toBe('partial');
    expect(component.batchResult()?.skipped).toHaveLength(1);
    expect(component.batchResult()?.created).toHaveLength(1);
  });

  it('erro → batchStatus "error" com mensagem e permanece no Step 2', async () => {
    const api = makeApi({
      createBatch: vi.fn(() => throwError(() => new Error('Falha na rede'))),
    });
    const { component } = await setup(api);
    component.step.set('preview');
    component.onSubmitBatch(sampleApartments);
    expect(component.batchStatus()).toBe('error');
    expect(component.batchError()).toBe('Falha na rede');
    expect(component.step()).toBe('preview');
  });

  it('apartmentsLink aponta para a rota correta do condomínio', async () => {
    const { component } = await setup();
    expect(component.apartmentsLink()).toBe('/app/condominiums/condo-1/apartments');
  });

  it('onSubmitBatch retorna imediatamente se condoId for null', async () => {
    const tenantNull = { ...mockTenant, activeCondominiumId: () => null as string | null };
    const api = makeApi();
    const { component } = await setup(api, tenantNull as typeof mockTenant);
    component.onSubmitBatch(sampleApartments);
    expect(api.createBatch).not.toHaveBeenCalled();
  });
});
