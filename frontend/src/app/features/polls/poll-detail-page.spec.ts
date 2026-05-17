import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PollDetailResponse,
  PollOptionResponse,
  PollResponse,
  PollsApiService,
} from '../../core/api/polls-api.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import PollDetailPage from './poll-detail-page';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

function makePoll(overrides: Partial<PollResponse> = {}): PollResponse {
  return {
    id: 'poll-1',
    condominiumId: 'condo-1',
    title: 'Votação de teste',
    description: 'Descrição da votação',
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
    ...overrides,
  };
}

const mockOptions: PollOptionResponse[] = [
  { id: 'opt-1', label: 'Sim', displayOrder: 1 },
  { id: 'opt-2', label: 'Não', displayOrder: 2 },
];

function makeDetail(overrides: Partial<PollResponse> = {}): PollDetailResponse {
  return {
    poll: makePoll(overrides),
    options: mockOptions,
    result: null,
  };
}

const mockActivatedRoute = {
  snapshot: { params: { condoId: 'condo-1', pollId: 'poll-1' } },
};

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {}

@Component({ selector: 'app-poll-status-badge', template: '', standalone: true })
class PollStatusBadgeStub {
  @Input() status = '';
}

@Component({ selector: 'app-poll-cancel-dialog', template: '', standalone: true })
class PollCancelDialogStub {
  @Input() open = false;
  @Output() readonly confirm = new EventEmitter<string>();
  @Output() readonly close = new EventEmitter<void>();
}

function makeApi(overrides: Partial<{
  getById: unknown;
  publish: unknown;
  open: unknown;
  close: unknown;
  cancel: unknown;
}> = {}) {
  return {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(() => of(makePoll())),
    open: vi.fn(() => of(makePoll({ status: 'OPEN' }))),
    close: vi.fn(() => of(makePoll({ status: 'CLOSED' }))),
    cancel: vi.fn(() => of(makePoll({ status: 'CANCELLED' }))),
    getById: vi.fn(() => of(makeDetail())),
    ...overrides,
  };
}

const mockRouter = { navigate: vi.fn() };

async function setup(apiOverrides: Parameters<typeof makeApi>[0] = {}) {
  const api = makeApi(apiOverrides);
  await TestBed.configureTestingModule({
    imports: [PollDetailPage],
    providers: [
      { provide: PollsApiService, useValue: api },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: Router, useValue: mockRouter },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
    ],
  })
    .overrideComponent(PollDetailPage, {
      set: { imports: [AppHeaderStub, PollStatusBadgeStub, PollCancelDialogStub] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(PollDetailPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, api };
}

describe('PollDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('carrega detalhes no init', async () => {
    const { component, api } = await setup();
    expect(api.getById).toHaveBeenCalledWith('poll-1');
    expect(component.pageState()).toBe('ready');
    expect(component.detail()).not.toBeNull();
  });

  it('mostra ações corretas para DRAFT (Editar, Publicar, Cancelar)', async () => {
    const { component } = await setup({
      getById: vi.fn(() => of(makeDetail({ status: 'DRAFT' }))),
    });
    expect(component.hasActions('DRAFT')).toBe(true);
    expect(typeof component.onEdit).toBe('function');
    expect(typeof component.onPublish).toBe('function');
    expect(typeof component.onCancelClick).toBe('function');
  });

  it('mostra ações corretas para SCHEDULED (Editar, Abrir agora, Cancelar)', async () => {
    const { component } = await setup({
      getById: vi.fn(() => of(makeDetail({ status: 'SCHEDULED' }))),
    });
    expect(component.hasActions('SCHEDULED')).toBe(true);
    expect(typeof component.onOpen).toBe('function');
  });

  it('mostra ações corretas para OPEN (Encerrar, Cancelar)', async () => {
    const { component } = await setup({
      getById: vi.fn(() => of(makeDetail({ status: 'OPEN' }))),
    });
    expect(component.hasActions('OPEN')).toBe(true);
    expect(typeof component.onClose).toBe('function');
  });

  it('não mostra ações para CLOSED', async () => {
    const { component } = await setup({
      getById: vi.fn(() => of(makeDetail({ status: 'CLOSED' }))),
    });
    expect(component.hasActions('CLOSED')).toBe(false);
  });

  it('não mostra ações para CANCELLED', async () => {
    const { component } = await setup({
      getById: vi.fn(() => of(makeDetail({ status: 'CANCELLED' }))),
    });
    expect(component.hasActions('CANCELLED')).toBe(false);
  });

  it('click em Publicar dispara pollsApi.publish', async () => {
    const publishMock = vi.fn(() => of(makePoll({ status: 'SCHEDULED' })));
    const getByIdMock = vi.fn(() => of(makeDetail({ status: 'DRAFT' })));
    const { component } = await setup({
      publish: publishMock,
      getById: getByIdMock,
    });

    component.onPublish();

    expect(publishMock).toHaveBeenCalledWith('poll-1');
  });

  it('click em Cancelar abre o dialog', async () => {
    const { component } = await setup();
    expect(component.showCancelDialog()).toBe(false);
    component.onCancelClick();
    expect(component.showCancelDialog()).toBe(true);
  });

  it('confirm no dialog dispara pollsApi.cancel e fecha dialog', async () => {
    const cancelMock = vi.fn(() => of(makePoll({ status: 'CANCELLED' })));
    const { component } = await setup({ cancel: cancelMock });

    component.showCancelDialog.set(true);
    component.onCancelConfirm('Motivo de cancelamento com tamanho suficiente');

    expect(cancelMock).toHaveBeenCalledWith('poll-1', {
      reason: 'Motivo de cancelamento com tamanho suficiente',
    });
    expect(component.showCancelDialog()).toBe(false);
  });

  it('erro de API em publish exibe mensagem de erro', async () => {
    const err = new HttpErrorResponse({ error: { message: 'Erro de validação' }, status: 400 });
    const { component } = await setup({
      publish: vi.fn(() => throwError(() => err)),
    });

    component.onPublish();

    expect(component.actionError()).toBe('Erro de validação');
  });

  it('erro 422 em open exibe mensagem amigável de sem elegíveis', async () => {
    const err = new HttpErrorResponse({ status: 422 });
    const { component } = await setup({
      open: vi.fn(() => throwError(() => err)),
    });

    component.onOpen();

    expect(component.actionError()).toContain('elegíveis');
  });

  it('erro de API em cancel exibe mensagem de erro', async () => {
    const err = new HttpErrorResponse({ error: { message: 'Erro ao cancelar' }, status: 500 });
    const { component } = await setup({
      cancel: vi.fn(() => throwError(() => err)),
    });

    component.showCancelDialog.set(true);
    component.onCancelConfirm('Motivo válido e bem longo para passar na validação');

    expect(component.actionError()).toBe('Erro ao cancelar');
  });

  it('erro no carregamento exibe pageState=error', async () => {
    const { component } = await setup({
      getById: vi.fn(() => throwError(() => new Error('Falha na rede'))),
    });
    expect(component.pageState()).toBe('error');
    expect(component.errorMessage()).toContain('Erro ao carregar votação');
  });
});
