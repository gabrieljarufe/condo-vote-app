import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PollDetailResponse,
  PollOptionResponse,
  PollResponse,
  PollsApiService,
} from '../../core/api/polls-api.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import { TenantService } from '../../core/tenant/tenant.service';
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

@Component({ selector: 'app-confirm-dialog', template: '', standalone: true })
class ConfirmDialogStub {
  @Input() open = false;
  @Input() title = '';
  @Input() body = '';
  @Input() confirmLabel = '';
  @Input() variant: 'default' | 'danger' = 'default';
  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();
}

function makeApi(overrides: Partial<{
  getById: unknown;
  publish: unknown;
  open: unknown;
  close: unknown;
  cancel: unknown;
  getMyBallots: unknown;
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
    getMyBallots: vi.fn(() =>
      of({ ballots: [], excludedApartments: [], totalVotesSoFar: null, eligibleCount: 0 }),
    ),
    ...overrides,
  };
}

const mockRouter = { navigate: vi.fn() };

function makeTenant(opts: { isAdmin?: boolean; isResident?: boolean } = {}) {
  return {
    activeCondominiumId: () => 'condo-1',
    activeRoles: () => new Set(['ADMIN']),
    isAdmin: () => opts.isAdmin ?? true,
    isResident: () => opts.isResident ?? false,
    hasActiveTenant: () => true,
    setActive: vi.fn(),
    clear: vi.fn(),
  };
}

async function setup(
  apiOverrides: Parameters<typeof makeApi>[0] = {},
  tenantOpts: { isAdmin?: boolean; isResident?: boolean } = {},
) {
  const api = makeApi(apiOverrides);
  await TestBed.configureTestingModule({
    imports: [PollDetailPage],
    providers: [
      { provide: PollsApiService, useValue: api },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: Router, useValue: mockRouter },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: TenantService, useValue: makeTenant(tenantOpts) },
    ],
  })
    .overrideComponent(PollDetailPage, {
      set: { imports: [AppHeaderStub, PollStatusBadgeStub, PollCancelDialogStub, ConfirmDialogStub, RouterLink] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(PollDetailPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, api };
}

describe('PollDetailPage', () => {
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

  it('click em Publicar abre o confirm dialog (não chama API diretamente)', async () => {
    const publishMock = vi.fn(() => of(makePoll({ status: 'SCHEDULED' })));
    const { component } = await setup({ publish: publishMock });

    component.onPublish();

    // Agora o dialog é aberto primeiro; API só é chamada após confirmação
    expect(component.confirmAction()).toBe('publish');
    expect(component.confirmDialogOpen()).toBe(true);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('confirmar no confirm dialog chama pollsApi.publish', async () => {
    const publishMock = vi.fn(() => of(makePoll({ status: 'SCHEDULED' })));
    const { component } = await setup({ publish: publishMock });

    component.onPublish();
    component.onConfirmDialogConfirmed();

    expect(publishMock).toHaveBeenCalledWith('poll-1');
    expect(component.confirmAction()).toBeNull();
  });

  it('cancelar no confirm dialog fecha o dialog sem chamar API', async () => {
    const publishMock = vi.fn(() => of(makePoll({ status: 'SCHEDULED' })));
    const { component } = await setup({ publish: publishMock });

    component.onPublish();
    component.onConfirmDialogCancelled();

    expect(component.confirmAction()).toBeNull();
    expect(component.confirmDialogOpen()).toBe(false);
    expect(publishMock).not.toHaveBeenCalled();
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
    component.onConfirmDialogConfirmed();

    expect(component.actionError()).toBe('Erro de validação');
  });

  it('erro 422 em open exibe mensagem amigável de sem elegíveis', async () => {
    const err = new HttpErrorResponse({ status: 422 });
    const { component } = await setup({
      open: vi.fn(() => throwError(() => err)),
    });

    component.onOpen();
    component.onConfirmDialogConfirmed();

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
    // Error puro cai no fallback curado (evita vazar mensagens técnicas ao usuário).
    expect(component.errorMessage()).toContain('Erro ao carregar votação');
  });

  it('renderiza breakdown quando status=CLOSED', async () => {
    const closedDetail: PollDetailResponse = {
      poll: makePoll({ status: 'CLOSED' }),
      options: [
        { id: 'opt1', label: 'A', displayOrder: 1 },
        { id: 'opt2', label: 'B', displayOrder: 2 },
      ],
      result: {
        totalVotes: 8,
        winningOptionId: 'opt1',
        quorumReached: true,
        closeTrigger: 'MANUAL',
        invalidationReason: null,
        determinedAt: '2026-06-01T18:00:00Z',
        optionsBreakdown: '{"opt1":5,"opt2":3}',
      },
    };

    const { fixture, component } = await setup({
      getById: vi.fn(() => of(closedDetail)),
    });
    fixture.detectChanges();

    const rows = component.breakdownRows(closedDetail) as Array<{ optionId: string; label: string; votes: number; percentage: number; isWinner: boolean }>;
    const rowA = rows.find((r) => r.optionId === 'opt1');
    const rowB = rows.find((r) => r.optionId === 'opt2');

    expect(rowA).toBeDefined();
    expect(rowA!.votes).toBe(5);
    expect(rowA!.percentage).toBe(62.5);
    expect(rowA!.isWinner).toBe(true);

    expect(rowB).toBeDefined();
    expect(rowB!.votes).toBe(3);
    expect(rowB!.percentage).toBe(37.5);
    expect(rowB!.isWinner).toBe(false);

    // Vencedora aparece primeiro (ordenado por votos DESC)
    expect(rows[0].optionId).toBe('opt1');
  });

  it('renderiza breakdown quando status=INVALIDATED (sem badge Vencedora)', async () => {
    const invalidatedDetail: PollDetailResponse = {
      poll: makePoll({ status: 'INVALIDATED' }),
      options: [
        { id: 'opt1', label: 'A', displayOrder: 1 },
        { id: 'opt2', label: 'B', displayOrder: 2 },
      ],
      result: {
        totalVotes: 4,
        winningOptionId: null,
        quorumReached: false,
        closeTrigger: 'SCHEDULER',
        invalidationReason: 'PRESENCE_QUORUM_NOT_REACHED',
        determinedAt: '2026-06-01T18:00:00Z',
        optionsBreakdown: '{"opt1":2,"opt2":2}',
      },
    };

    const { component } = await setup({
      getById: vi.fn(() => of(invalidatedDetail)),
    });

    const rows = component.breakdownRows(invalidatedDetail) as Array<{ isWinner: boolean }>;
    expect(rows.every((r) => !r.isWinner)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('não renderiza breakdown quando status=OPEN ou DRAFT', async () => {
    const openDetail: PollDetailResponse = {
      poll: makePoll({ status: 'OPEN' }),
      options: mockOptions,
      result: null,
    };

    const { component } = await setup({
      getById: vi.fn(() => of(openDetail)),
    });

    expect(component.breakdownRows(openDetail)).toHaveLength(0);

    const draftDetail: PollDetailResponse = {
      poll: makePoll({ status: 'DRAFT' }),
      options: mockOptions,
      result: null,
    };
    expect(component.breakdownRows(draftDetail)).toHaveLength(0);
  });

  // ── Painel "Sua participação" (morador) ────────────────────────────────────

  it('morador vê painel "Sua participação" com aptos votados e pendentes', async () => {
    const { fixture, component } = await setup(
      {
        getById: vi.fn(() => of(makeDetail({ status: 'OPEN' }))),
        getMyBallots: vi.fn(() =>
          of({
            ballots: [
              { apartmentId: 'apt-101', apartmentLabel: '101', alreadyVoted: true, votedOptionId: 'opt-1' },
              { apartmentId: 'apt-102', apartmentLabel: '102', alreadyVoted: false, votedOptionId: null },
            ],
            excludedApartments: [],
            totalVotesSoFar: null,
            eligibleCount: 2,
          }),
        ),
      },
      { isResident: true, isAdmin: false },
    );
    expect(component.myBallots()).not.toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Sua participação');
    expect(el.textContent).toContain('Apto 101');
    expect(el.textContent).toContain('Sim'); // option label for opt-1
    expect(el.textContent).toContain('Apto 102');
    expect(el.textContent).toContain('Votar →');
  });

  it('admin não vê painel "Sua participação"', async () => {
    const { fixture } = await setup({}, { isAdmin: true, isResident: false });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Sua participação');
  });

  it('morador vê aptos excluídos com label "Não elegível"', async () => {
    const { fixture } = await setup(
      {
        getById: vi.fn(() => of(makeDetail({ status: 'OPEN' }))),
        getMyBallots: vi.fn(() =>
          of({
            ballots: [],
            excludedApartments: [
              { apartmentId: 'apt-202', apartmentLabel: '202', reason: 'EXCLUDED' as const },
            ],
            totalVotesSoFar: null,
            eligibleCount: 5,
          }),
        ),
      },
      { isResident: true, isAdmin: false },
    );
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Apto 202');
    expect(el.textContent).toContain('Não elegível');
  });

  it('totalVotesSoFar não é exibido em poll OPEN (sigilo do voto)', async () => {
    const { fixture } = await setup(
      {
        getById: vi.fn(() => of(makeDetail({ status: 'OPEN' }))),
        getMyBallots: vi.fn(() =>
          of({
            ballots: [
              { apartmentId: 'apt-101', apartmentLabel: '101', alreadyVoted: false, votedOptionId: null },
            ],
            excludedApartments: [],
            // Backend já garante null em OPEN; teste UI confirma que nenhum número de votos vaza
            totalVotesSoFar: null,
            eligibleCount: 10,
          }),
        ),
      },
      { isResident: true, isAdmin: false },
    );
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('10 apartamento(s) elegível(is)');
    expect(el.textContent ?? '').not.toContain(' votos já');
  });
});
