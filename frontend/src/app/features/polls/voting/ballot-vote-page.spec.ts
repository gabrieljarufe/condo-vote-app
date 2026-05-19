import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  MyBallotResponse,
  PollDetailResponse,
  PollOptionResponse,
  PollsApiService,
} from '../../../core/api/polls-api.service';
import { SUPABASE_CLIENT } from '../../../core/auth/supabase.client';
import BallotVotePage from './ballot-vote-page';

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

@Component({ selector: 'app-spinner', template: '', standalone: true })
class SpinnerStub {}

@Component({
  selector: 'app-ballot-card',
  template: '',
  standalone: true,
})
class BallotCardStub {
  @Input() apartmentLabel = '';
  @Input() options: ReadonlyArray<PollOptionResponse> = [];
  @Input() selectedOptionId: string | null = null;
  @Input() disabled = false;
  @Input() radioGroupName = 'ballot-options';
  @Output() readonly optionChange = new EventEmitter<string>();
}

// ─── Factories ────────────────────────────────────────────────────────────────

const OPTIONS: ReadonlyArray<PollOptionResponse> = [
  { id: 'opt-sim', label: 'Sim', displayOrder: 0 },
  { id: 'opt-nao', label: 'Não', displayOrder: 1 },
];

function makePollDetail(overrides: Partial<PollDetailResponse> = {}): PollDetailResponse {
  return {
    poll: {
      id: 'poll-1',
      condominiumId: 'condo-1',
      title: 'Votação anual',
      description: null,
      convocation: 'FIRST',
      quorumMode: 'SIMPLE_MAJORITY',
      status: 'OPEN',
      scheduledStart: '2026-06-01T09:00:00Z',
      scheduledEnd: '2026-06-01T18:00:00Z',
      openedAt: '2026-06-01T09:00:00Z',
      eligibleCount: 10,
      closedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: '2026-05-01T00:00:00Z',
    },
    options: OPTIONS,
    result: null,
    ...overrides,
  };
}

function makeBallot(overrides: Partial<MyBallotResponse> = {}): MyBallotResponse {
  return {
    apartmentId: 'apt-101',
    apartmentLabel: '101',
    alreadyVoted: false,
    votedOptionId: null,
    ...overrides,
  };
}

function makeMyBallots(
  ballots: ReadonlyArray<MyBallotResponse>,
  excluded: ReadonlyArray<{ apartmentId: string; apartmentLabel: string; reason: 'EXCLUDED' }> = [],
) {
  return {
    ballots,
    excludedApartments: excluded,
    totalVotesSoFar: null,
    eligibleCount: ballots.length,
  };
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
    getById: vi.fn(() => of(makePollDetail())),
    getMyBallots: vi.fn(() => of(makeMyBallots([makeBallot()]))),
    submitVote: vi.fn(() => of({ id: 'vote-1', pollId: 'poll-1', apartmentId: 'apt-101', optionId: 'opt-sim', votedAt: '' })),
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

const mockRouter = {
  navigate: vi.fn(),
};

async function setup(apiOverrides: Parameters<typeof makeApi>[0] = {}) {
  mockRouter.navigate.mockReset();
  const api = makeApi(apiOverrides);
  await TestBed.configureTestingModule({
    imports: [BallotVotePage],
    providers: [
      { provide: PollsApiService, useValue: api },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: Router, useValue: mockRouter },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      provideLocationMocks(),
    ],
  })
    .overrideComponent(BallotVotePage, {
      set: { imports: [AppHeaderStub, SpinnerStub, BallotCardStub, RouterLink] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(BallotVotePage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, api };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BallotVotePage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza breadcrumb "Minhas votações" no topo apontando para a lista de votações', async () => {
    const { fixture } = await setup();
    const link = fixture.nativeElement.querySelector('main a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Minhas votações');
  });

  it('renderiza 1 cédula quando há 1 ballot pendente', async () => {
    const { component } = await setup();
    expect(component.state().kind).toBe('ready');
    expect(component.pendingBallots()).toHaveLength(1);
    expect(component.pendingBallots()[0].apartmentLabel).toBe('101');
  });

  it('renderiza texto explicativo com count quando há ≥2 ballots pendentes', async () => {
    const ballot1 = makeBallot({ apartmentId: 'apt-101', apartmentLabel: '101' });
    const ballot2 = makeBallot({ apartmentId: 'apt-202', apartmentLabel: '202' });
    const { fixture, component } = await setup({
      getMyBallots: vi.fn(() => of(makeMyBallots([ballot1, ballot2]))),
    });
    fixture.detectChanges();
    expect(component.pendingBallots()).toHaveLength(2);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2 apartamentos elegíveis');
  });

  it('botão "Confirmar voto" disabled quando selectedOptionId é null', async () => {
    const { fixture, component } = await setup();
    fixture.detectChanges();
    expect(component.selectedOptionId()).toBeNull();
    const button = fixture.nativeElement.querySelector('button');
    expect(button?.disabled).toBe(true);
  });

  it('clicar confirmar com 1 ballot dispara submitVote e navega para /polls?tab=pendentes', async () => {
    const { fixture, component, api } = await setup();
    component.selectedOptionId.set('opt-sim');
    fixture.detectChanges();

    component.onConfirm();
    fixture.detectChanges();

    expect(api.submitVote).toHaveBeenCalledWith('poll-1', 'apt-101', 'opt-sim', false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/app/condominiums', 'condo-1', 'polls'],
      { queryParams: { tab: 'pendentes' } },
    );
  });

  it('clicar confirmar com 2+ ballots dispara submitVote e abre modal de bulk', async () => {
    const ballot1 = makeBallot({ apartmentId: 'apt-101', apartmentLabel: '101' });
    const ballot2 = makeBallot({ apartmentId: 'apt-202', apartmentLabel: '202' });
    const { fixture, component, api } = await setup({
      getMyBallots: vi.fn(() => of(makeMyBallots([ballot1, ballot2]))),
    });
    fixture.detectChanges();
    component.selectedOptionId.set('opt-sim');
    fixture.detectChanges();

    component.onConfirm();
    fixture.detectChanges();

    expect(api.submitVote).toHaveBeenCalledWith('poll-1', 'apt-101', 'opt-sim', false);
    expect(component.showBulkPrompt()).toBe(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Aplicar aos demais apartamentos?');
  });

  it('modal "Revisar e aplicar" navega para .../vote/review', async () => {
    const ballot1 = makeBallot({ apartmentId: 'apt-101', apartmentLabel: '101' });
    const ballot2 = makeBallot({ apartmentId: 'apt-202', apartmentLabel: '202' });
    const { fixture, component } = await setup({
      getMyBallots: vi.fn(() => of(makeMyBallots([ballot1, ballot2]))),
    });
    fixture.detectChanges();
    component.selectedOptionId.set('opt-sim');
    // Simulate modal shown after submit
    component.showBulkPrompt.set(true);
    fixture.detectChanges();

    component.onApplyBulk();

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/app/condominiums', 'condo-1', 'polls', 'poll-1', 'vote', 'review'],
      expect.objectContaining({
        state: expect.objectContaining({
          appliedOptionId: 'opt-sim',
          remainingBallots: [ballot2],
          pollTitle: 'Votação anual',
        }),
      }),
    );
  });

  it('erro 409 mostra mensagem "votação encerrada"', async () => {
    const { fixture, component } = await setup({
      submitVote: vi.fn(() => throwError(() => ({ status: 409, message: 'Conflict' }))),
    });
    fixture.detectChanges();
    component.selectedOptionId.set('opt-sim');
    fixture.detectChanges();

    component.onConfirm();
    fixture.detectChanges();

    expect(component.submitError()).toContain('encerrada');
  });

  it('quando pendingBallots vazio mostra mensagem "já votou em todas"', async () => {
    const votedBallot = makeBallot({ alreadyVoted: true, votedOptionId: 'opt-sim' });
    const { fixture } = await setup({
      getMyBallots: vi.fn(() => of(makeMyBallots([votedBallot]))),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Você já votou em todas as suas cédulas');
  });

  it('banner de inadimplência aparece quando há apartamentos excluídos', async () => {
    const { fixture, component } = await setup({
      getMyBallots: vi.fn(() =>
        of(
          makeMyBallots(
            [makeBallot({ apartmentId: 'apt-101', apartmentLabel: '101' })],
            [{ apartmentId: 'apt-202', apartmentLabel: '202', reason: 'EXCLUDED' as const }],
          ),
        ),
      ),
    });
    fixture.detectChanges();
    const s = component.state();
    expect(s.kind).toBe('ready');
    expect(s.myBallots.excludedApartments).toHaveLength(1);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Apartamentos fora desta votação');
    expect(el.textContent).toContain('Apto 202');
  });

  it('sem apartamentos excluídos, banner de inadimplência não aparece', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Apartamentos fora desta votação');
  });

  it('quando myBallots vazia mostra painel "não pode votar" sem CTA de voto', async () => {
    const { fixture, component } = await setup({
      getMyBallots: vi.fn(() => of(makeMyBallots([]))),
    });
    fixture.detectChanges();
    expect(component.voteEligibility()).toBe('not-eligible');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Você não pode votar nesta votação');
    expect(el.textContent).toContain('inadimplente');
    // Não deve exibir o botão "Confirmar voto"
    const button = el.querySelector('button');
    expect(button).toBeNull();
  });
});
