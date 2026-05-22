import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CreatePollRequest,
  PollDetailResponse,
  PollOptionResponse,
  PollResponse,
  PollsApiService,
} from '../../core/api/polls-api.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import PollEditPage, { toLocalDatetimeInput } from './poll-edit-page';
import { PollFormValue } from './poll-form';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

function makePollResponse(status: PollResponse['status'] = 'DRAFT'): PollResponse {
  return {
    id: 'poll-1',
    condominiumId: 'condo-1',
    title: 'Votação existente',
    description: 'Descrição',
    convocation: 'FIRST',
    quorumMode: 'SIMPLE_MAJORITY',
    status,
    scheduledStart: '2026-06-01T10:00:00Z',
    scheduledEnd: '2026-06-01T18:00:00Z',
    openedAt: null,
    eligibleCount: null,
    closedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: '2026-05-01T00:00:00Z',
  };
}

function makeOptions(): PollOptionResponse[] {
  return [
    { id: 'opt-1', label: 'Sim', displayOrder: 1 },
    { id: 'opt-2', label: 'Não', displayOrder: 2 },
  ];
}

function makeDetail(status: PollResponse['status'] = 'DRAFT'): PollDetailResponse {
  return {
    poll: makePollResponse(status),
    options: makeOptions(),
    result: null,
  };
}

@Component({
  selector: 'app-poll-form',
  template: '',
  standalone: true,
})
class PollFormStub {
  @Input() initialValue: PollFormValue | null = null;
  @Input() submitLabel = '';
  @Output() readonly submit = new EventEmitter<CreatePollRequest>();
  @Output() readonly cancel = new EventEmitter<void>();
  setError = vi.fn();
}

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {}

@Component({ selector: 'app-spinner', template: '', standalone: true })
class SpinnerStub {
  @Input() label = '';
}

function makeApi(overrides: Partial<{ getById: unknown; update: unknown }> = {}) {
  return {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(() => of(makePollResponse())),
    publish: vi.fn(),
    open: vi.fn(),
    cancel: vi.fn(),
    close: vi.fn(),
    getById: vi.fn(() => of(makeDetail())),
    ...overrides,
  };
}

const mockRouter = { navigate: vi.fn() };

async function setup(
  api = makeApi(),
  routeParams: { condoId: string; pollId: string } = { condoId: 'condo-1', pollId: 'poll-1' },
) {
  await TestBed.configureTestingModule({
    imports: [PollEditPage],
    providers: [
      { provide: PollsApiService, useValue: api },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { params: routeParams } },
      },
      { provide: Router, useValue: mockRouter },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
    ],
  })
    .overrideComponent(PollEditPage, {
      set: { imports: [PollFormStub, AppHeaderStub, SpinnerStub] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(PollEditPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, api };
}

const mockRequest: CreatePollRequest = {
  title: 'Votação atualizada',
  convocation: 'FIRST',
  quorumMode: 'SIMPLE_MAJORITY',
  scheduledStart: '2026-06-01T10:00:00.000Z',
  scheduledEnd: '2026-06-01T18:00:00.000Z',
  options: ['Sim', 'Não'],
};

describe('PollEditPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lê condoId e pollId da rota no init', async () => {
    const { component } = await setup();
    expect(component.condoId).toBe('condo-1');
    expect(component.pollId).toBe('poll-1');
  });

  it('chama getById no init com pollId', async () => {
    const api = makeApi();
    await setup(api);
    expect(api.getById).toHaveBeenCalledWith('poll-1');
  });

  it('pageState = ready quando poll é DRAFT', async () => {
    const { component } = await setup(makeApi({ getById: vi.fn(() => of(makeDetail('DRAFT'))) }));
    expect(component.pageState()).toBe('ready');
  });

  it('pageState = ready quando poll é SCHEDULED', async () => {
    const { component } = await setup(
      makeApi({ getById: vi.fn(() => of(makeDetail('SCHEDULED'))) }),
    );
    expect(component.pageState()).toBe('ready');
  });

  it('popula initialValue com dados do poll', async () => {
    const { component } = await setup();
    const val = component.initialValue() as PollFormValue;
    expect(val.title).toBe('Votação existente');
    // scheduledStart: '2026-06-01T10:00:00Z' = '2026-06-01T07:00' em America/Sao_Paulo (UTC-3)
    expect(val.scheduledStart).toBe('2026-06-01T07:00');
    expect(val.options).toEqual(['Sim', 'Não']);
  });

  it('scheduledStart é convertido para datetime-local (sem timezone)', async () => {
    const { component } = await setup();
    const val = component.initialValue() as PollFormValue;
    expect(val.scheduledStart).toHaveLength(16);
    expect(val.scheduledStart).not.toContain('Z');
  });

  // --- Bloqueio de edição por status ---

  it.each(['OPEN', 'CLOSED', 'INVALIDATED', 'CANCELLED'] as PollResponse['status'][])(
    'pageState = blocked quando status é %s',
    async (status) => {
      const { component } = await setup(
        makeApi({ getById: vi.fn(() => of(makeDetail(status))) }),
      );
      expect(component.pageState()).toBe('blocked');
      expect(component.blockedStatus()).toBe(status);
    },
  );

  // --- Erro de carregamento ---

  it('pageState = error quando getById falha', async () => {
    const api = makeApi({
      getById: vi.fn(() => throwError(() => new Error('Falha de rede'))),
    });
    const { component } = await setup(api);
    expect(component.pageState()).toBe('error');
    // Erros não-HttpErrorResponse caem no fallback
    expect(component.errorMessage()).toBe('Erro ao carregar votação.');
  });

  it('extrai message de HttpErrorResponse no carregamento', async () => {
    const err = new HttpErrorResponse({ error: { message: 'Não encontrado' }, status: 404 });
    const api = makeApi({ getById: vi.fn(() => throwError(() => err)) });
    const { component } = await setup(api);
    expect(component.errorMessage()).toBe('Não encontrado');
  });

  // --- Submit ---

  it('ao submeter chama pollsApi.update com pollId e request', async () => {
    const api = makeApi();
    const { component } = await setup(api);
    component.onSubmit(mockRequest);
    expect(api.update).toHaveBeenCalledWith('poll-1', mockRequest);
  });

  it('em sucesso navega para detalhe do poll', async () => {
    mockRouter.navigate = vi.fn();
    const { component } = await setup();
    component.onSubmit(mockRequest);
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/app/condominiums/condo-1/polls/poll-1',
    ]);
  });

  it('em erro de update chama setError no form', async () => {
    const err = new HttpErrorResponse({ error: { message: 'Conflito' }, status: 409 });
    const api = makeApi({ update: vi.fn(() => throwError(() => err)) });
    const { component } = await setup(api);
    // Should not throw
    expect(() => component.onSubmit(mockRequest)).not.toThrow();
    // API was called
    expect(api.update).toHaveBeenCalledOnce();
  });

  // --- Cancel ---

  it('onCancel navega para detalhe do poll', async () => {
    mockRouter.navigate = vi.fn();
    const { component } = await setup();
    component.onCancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app/condominiums/condo-1/polls/poll-1']);
  });

  it('detailLink é construído com condoId e pollId', async () => {
    const { component } = await setup();
    expect(component.detailLink()).toBe('/app/condominiums/condo-1/polls/poll-1');
  });
});

describe('toLocalDatetimeInput', () => {
  it('converte ISO UTC para hora local sem Z (formato datetime-local)', () => {
    // TZ=America/Sao_Paulo (UTC-3): 22:00Z → 19:00 local
    const result = toLocalDatetimeInput('2026-05-17T22:00:00Z');
    expect(result).toBe('2026-05-17T19:00');
    expect(result).not.toContain('Z');
    expect(result).toHaveLength(16);
  });

  it('preserva data correta ao cruzar meia-noite UTC→BRT', () => {
    // 01:00Z no dia 18 = 22:00 do dia 17 em BRT
    const result = toLocalDatetimeInput('2026-05-18T01:00:00Z');
    expect(result).toBe('2026-05-17T22:00');
  });

  it('funciona com horário que já está em hora local (sem conversão inesperada)', () => {
    // 12:00Z = 09:00 BRT
    const result = toLocalDatetimeInput('2026-05-17T12:00:00Z');
    expect(result).toBe('2026-05-17T09:00');
  });
});
