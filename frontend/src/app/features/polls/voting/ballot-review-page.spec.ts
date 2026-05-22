import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  MyBallotResponse,
  PollOptionResponse,
  PollsApiService,
} from '../../../core/api/polls-api.service';
import { SUPABASE_CLIENT } from '../../../core/auth/supabase.client';
import { SuccessPopup } from '../../../shared/ui/success-popup';
import BallotReviewPage from './ballot-review-page';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {}

// ─── Factories ────────────────────────────────────────────────────────────────

const OPTIONS: ReadonlyArray<PollOptionResponse> = [
  { id: 'opt-sim', label: 'Sim', displayOrder: 0 },
  { id: 'opt-nao', label: 'Não', displayOrder: 1 },
];

function makeBallot(
  overrides: Partial<MyBallotResponse> = {},
): MyBallotResponse {
  return {
    apartmentId: 'apt-101',
    apartmentLabel: '101',
    alreadyVoted: false,
    votedOptionId: null,
    ...overrides,
  };
}

const BALLOT_1 = makeBallot({ apartmentId: 'apt-101', apartmentLabel: '101' });
const BALLOT_2 = makeBallot({ apartmentId: 'apt-202', apartmentLabel: '202' });
const BALLOT_3 = makeBallot({ apartmentId: 'apt-303', apartmentLabel: '303' });

const VALID_STATE = {
  appliedOptionId: 'opt-sim',
  remainingBallots: [BALLOT_1, BALLOT_2, BALLOT_3],
  pollOptions: OPTIONS,
  pollTitle: 'Votação Anual 2026',
};

function makeVoteResponse(apartmentId: string) {
  return { id: 'vote-x', pollId: 'poll-1', apartmentId, optionId: 'opt-sim', votedAt: '' };
}

function makeApi(overrides: Partial<Record<string, unknown>> = {}) {
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
    submitVote: vi.fn((_, aptId: string) => of(makeVoteResponse(aptId))),
    getMyPendingPolls: vi.fn(),
    ...overrides,
  };
}

const mockActivatedRoute = {
  snapshot: {
    paramMap: {
      get: (key: string) => {
        if (key === 'condoId') return 'condo-1';
        if (key === 'pollId') return 'poll-1';
        return null;
      },
    },
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

function makeRouter(navState: unknown) {
  return {
    navigate: vi.fn(),
    // Always return a navigation object so the component never falls back to
    // `history.state` (which is unpredictable in jsdom across test runs).
    getCurrentNavigation: vi.fn().mockReturnValue({ extras: { state: navState } }),
  };
}

async function setup(options: {
  navState?: unknown;
  apiOverrides?: Parameters<typeof makeApi>[0];
} = {}) {
  const { navState = VALID_STATE, apiOverrides = {} } = options;
  const mockRouter = makeRouter(navState);
  const api = makeApi(apiOverrides);

  await TestBed.configureTestingModule({
    imports: [BallotReviewPage],
    providers: [
      { provide: PollsApiService, useValue: api },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: Router, useValue: mockRouter },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      provideLocationMocks(),
    ],
  })
    .overrideComponent(BallotReviewPage, {
      set: { imports: [AppHeaderStub, RouterLink, SuccessPopup] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(BallotReviewPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, api, mockRouter };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BallotReviewPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('redirecionamento quando state inválido', () => {
    it('redireciona quando state é null (sem appliedOptionId)', async () => {
      // Passa null explicitamente como state — nav?.extras?.state === null,
      // null?.appliedOptionId === undefined (falsy) → deve redirecionar.
      const { mockRouter } = await setup({ navState: null });
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/app/condominiums',
        'condo-1',
        'polls',
        'poll-1',
        'vote',
      ]);
    });

    it('redireciona quando state não tem appliedOptionId', async () => {
      const { mockRouter } = await setup({
        navState: { remainingBallots: [BALLOT_1], pollOptions: OPTIONS, pollTitle: 'Test' },
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/app/condominiums',
        'condo-1',
        'polls',
        'poll-1',
        'vote',
      ]);
    });

    it('redireciona quando remainingBallots está vazio', async () => {
      const { mockRouter } = await setup({
        navState: {
          appliedOptionId: 'opt-sim',
          remainingBallots: [],
          pollOptions: OPTIONS,
          pollTitle: 'Test',
        },
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/app/condominiums',
        'condo-1',
        'polls',
        'poll-1',
        'vote',
      ]);
    });
  });

  describe('renderização com state válido', () => {
    it('renderiza breadcrumb "Voltar à votação" no topo apontando para a vote-page', async () => {
      const { fixture } = await setup();
      const link = fixture.nativeElement.querySelector('main a') as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('Voltar à votação');
    });

    it('renderiza N cards quando state válido — 3 remainingBallots → 3 cards', async () => {
      const { component } = await setup();
      expect(component.rows()).toHaveLength(3);
      expect(component.stateData()).not.toBeNull();
    });

    it('pré-seleciona appliedOptionId em todas as rows', async () => {
      const { component } = await setup();
      const rows = component.rows() as Array<{ ballot: MyBallotResponse; optionId: string }>;
      expect(rows.every((r) => r.optionId === 'opt-sim')).toBe(true);
    });

    it('exibe o título da votação', async () => {
      const { fixture } = await setup();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Votação Anual 2026');
    });
  });

  describe('lista somente leitura', () => {
    it('renderiza apto + label da opção em cada linha', async () => {
      const { fixture } = await setup();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Apto 101');
      expect(el.textContent).toContain('Apto 202');
      expect(el.textContent).toContain('Apto 303');
      // label 'Sim' aparece 3x (uma por linha)
      const matches = (el.textContent ?? '').match(/Sim/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('texto explicativo cita N apartamentos', async () => {
      const { fixture } = await setup();
      expect(fixture.nativeElement.textContent).toContain('3 apartamentos abaixo');
    });
  });

  describe('onConfirmAll', () => {
    it('dispara N submitVote em paralelo com bulkOperation=true', async () => {
      const { component, api } = await setup();

      component.onConfirmAll();

      expect(api.submitVote).toHaveBeenCalledTimes(3);
      expect(api.submitVote).toHaveBeenCalledWith('poll-1', 'apt-101', 'opt-sim', true);
      expect(api.submitVote).toHaveBeenCalledWith('poll-1', 'apt-202', 'opt-sim', true);
      expect(api.submitVote).toHaveBeenCalledWith('poll-1', 'apt-303', 'opt-sim', true);
    });

    it('sucesso total — abre success popup com voteCount=N e o popup mostra o número correto', async () => {
      const { component, fixture } = await setup();

      component.onConfirmAll();
      fixture.detectChanges();

      expect(component.showSuccessPopup()).toBe(true);
      expect(component.successCount()).toBe(3);
      expect(component.failureCount()).toBe(0);
    });

    it('falha parcial — mostra mistura de sucesso e erro + botão de retry', async () => {
      const { component, fixture } = await setup({
        apiOverrides: {
          submitVote: vi.fn((_, aptId: string) =>
            aptId === 'apt-202'
              ? throwError(() => ({ status: 409 }))
              : of(makeVoteResponse(aptId)),
          ),
        },
      });

      component.onConfirmAll();
      fixture.detectChanges();

      expect(component.successCount()).toBe(2);
      expect(component.failureCount()).toBe(1);
      expect(component.showSuccessPopup()).toBe(false);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('✓ Registrado');
      expect(el.textContent).toContain('Votação encerrada/duplicada');
      expect(el.textContent).toContain('Tentar novamente nas falhas');
    });

    it('erro genérico (não 409) mostra mensagem "Falha ao registrar"', async () => {
      const { component, fixture } = await setup({
        apiOverrides: {
          submitVote: vi.fn(() => throwError(() => ({ status: 500 }))),
        },
      });

      component.onConfirmAll();
      fixture.detectChanges();

      expect(component.failureCount()).toBe(3);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Falha ao registrar');
    });
  });

  describe('onRetryFailed', () => {
    it('retry re-submete apenas os falhados, não os que já tiveram sucesso', async () => {
      // Primeira rodada: apt-202 falha; apt-101 e apt-303 passam
      const submitVoteMock = vi.fn((_, aptId: string) =>
        aptId === 'apt-202'
          ? throwError(() => ({ status: 409 }))
          : of(makeVoteResponse(aptId)),
      );
      const { component, fixture } = await setup({
        apiOverrides: { submitVote: submitVoteMock },
      });

      // Executa submit inicial
      component.onConfirmAll();
      fixture.detectChanges();

      expect(component.failureCount()).toBe(1);
      expect(component.successCount()).toBe(2);

      // Na segunda rodada, apt-202 passa
      submitVoteMock.mockImplementation((_, aptId: string) =>
        of(makeVoteResponse(aptId)),
      );

      // Retry
      component.onRetryFailed();
      fixture.detectChanges();

      // Deve ter submetido apenas 1 voto (apt-202)
      // Chamadas totais: 3 (primeira rodada) + 1 (retry)
      expect(submitVoteMock).toHaveBeenCalledTimes(4);

      // Resultado pós-retry: só apt-202 retentado
      expect(component.rows()).toHaveLength(1);
      expect((component.rows() as Array<{ ballot: MyBallotResponse }>)[0].ballot.apartmentId).toBe('apt-202');
    });
  });

  describe('backToList', () => {
    it('navega para /my-polls do condomínio', async () => {
      const { component, mockRouter } = await setup();

      component.backToList();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/app/condominiums',
        'condo-1',
        'my-polls',
      ]);
    });
  });

  describe('onSuccessClosed', () => {
    it('fecha popup e navega para /my-polls', async () => {
      const { component, mockRouter } = await setup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).showSuccessPopup.set(true);

      component.onSuccessClosed();

      expect(component.showSuccessPopup()).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/app/condominiums',
        'condo-1',
        'my-polls',
      ]);
    });
  });
});
