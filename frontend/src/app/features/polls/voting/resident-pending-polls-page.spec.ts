import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MyPendingPollResponse, PollsApiService } from '../../../core/api/polls-api.service';
import { SUPABASE_CLIENT } from '../../../core/auth/supabase.client';
import ResidentPendingPollsPage from './resident-pending-polls-page';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

const mockActivatedRoute = {
  snapshot: {
    paramMap: {
      get: (key: string) => (key === 'condoId' ? 'condo-1' : null),
    },
  },
};

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {}

@Component({ selector: 'app-spinner', template: '', standalone: true })
class SpinnerStub {}

function makePendingPoll(overrides: Partial<MyPendingPollResponse> = {}): MyPendingPollResponse {
  return {
    pollId: 'poll-1',
    title: 'Votação de teste',
    scheduledEnd: '2026-06-01T18:00:00Z',
    pendingBallotsCount: 2,
    totalBallotsCount: 5,
    ...overrides,
  };
}

function makeApi(overrides: Partial<{ getMyPendingPolls: unknown }> = {}) {
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
    submitVote: vi.fn(),
    getMyPendingPolls: vi.fn(() => of([makePendingPoll()])),
    ...overrides,
  };
}

async function setup(apiOverrides: Parameters<typeof makeApi>[0] = {}) {
  const api = makeApi(apiOverrides);
  await TestBed.configureTestingModule({
    imports: [ResidentPendingPollsPage],
    providers: [
      { provide: PollsApiService, useValue: api },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
    ],
  })
    .overrideComponent(ResidentPendingPollsPage, {
      set: { imports: [AppHeaderStub, SpinnerStub, DatePipe] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(ResidentPendingPollsPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component, api };
}

describe('ResidentPendingPollsPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza lista quando há polls pendentes', async () => {
    const { component } = await setup();
    expect(component.state().kind).toBe('ready');
    expect(component.polls()).toHaveLength(1);
    expect(component.polls()[0].title).toBe('Votação de teste');
  });

  it('renderiza estado vazio quando lista é []', async () => {
    const { component } = await setup({
      getMyPendingPolls: vi.fn(() => of([])),
    });
    expect(component.state().kind).toBe('ready');
    expect(component.polls()).toHaveLength(0);
  });

  it('renderiza erro quando API falha', async () => {
    const { component } = await setup({
      getMyPendingPolls: vi.fn(() => throwError(() => new Error('Falha na rede'))),
    });
    expect(component.state().kind).toBe('error');
    expect(component.errorMessage()).toBe('Falha na rede');
  });

  it('condoId vem do parâmetro de rota', async () => {
    const { component, api } = await setup();
    expect(component.condoId()).toBe('condo-1');
    expect(api.getMyPendingPolls).toHaveBeenCalledWith('condo-1');
  });
});
