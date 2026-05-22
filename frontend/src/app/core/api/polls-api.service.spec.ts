import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import {
  PollsApiService,
  PollResponse,
  PollDetailResponse,
  Page,
  VoteResponse,
  MyBallotResponse,
  MyPendingPollResponse,
} from './polls-api.service';

const mockPoll: PollResponse = {
  id: 'poll-1',
  condominiumId: 'condo-1',
  title: 'Votação de teste',
  description: null,
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
};

const mockPage: Page<PollResponse> = {
  content: [mockPoll],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

const mockDetail: PollDetailResponse = {
  poll: mockPoll,
  options: [{ id: 'opt-1', label: 'Sim', displayOrder: 1 }],
  result: null,
};

describe('PollsApiService', () => {
  let service: PollsApiService;
  let httpMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpMock = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpMock as unknown as HttpClient }],
    });
    service = TestBed.inject(PollsApiService);
  });

  it('list faz GET no endpoint correto com page/size default sem status', () => {
    httpMock.get.mockReturnValue(of(mockPage));
    let result: Page<PollResponse> | null = null;
    service.list('condo-1').subscribe((r) => (result = r));
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/polls'),
      expect.objectContaining({ params: expect.anything() }),
    );
    const params = httpMock.get.mock.calls[0][1].params;
    expect(params.get('page')).toBe('0');
    expect(params.get('size')).toBe('10');
    expect(params.get('status')).toBeNull();
    expect((result as Page<PollResponse> | null)?.content).toHaveLength(1);
  });

  it('list inclui status nos params quando fornecido', () => {
    httpMock.get.mockReturnValue(of(mockPage));
    service.list('condo-1', 'OPEN', 1, 20).subscribe();
    const params = httpMock.get.mock.calls[0][1].params;
    expect(params.get('status')).toBe('OPEN');
    expect(params.get('page')).toBe('1');
    expect(params.get('size')).toBe('20');
  });

  it('create faz POST com body correto', () => {
    httpMock.post.mockReturnValue(of(mockPoll));
    let result: PollResponse | null = null;
    const req = {
      title: 'Votação de teste',
      convocation: 'FIRST' as const,
      quorumMode: 'SIMPLE_MAJORITY' as const,
      scheduledStart: '2026-06-01T10:00:00Z',
      scheduledEnd: '2026-06-01T18:00:00Z',
      options: ['Sim', 'Não'],
    };
    service.create('condo-1', req).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/polls'),
      req,
    );
    expect((result as PollResponse | null)?.title).toBe('Votação de teste');
  });

  it('update faz PUT no endpoint correto', () => {
    const updated = { ...mockPoll, title: 'Atualizado' };
    httpMock.put.mockReturnValue(of(updated));
    let result: PollResponse | null = null;
    const req = {
      title: 'Atualizado',
      convocation: 'FIRST' as const,
      quorumMode: 'SIMPLE_MAJORITY' as const,
      scheduledStart: '2026-06-01T10:00:00Z',
      scheduledEnd: '2026-06-01T18:00:00Z',
      options: ['Sim', 'Não'],
    };
    service.update('poll-1', req).subscribe((r) => (result = r));
    expect(httpMock.put).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1'),
      req,
    );
    expect((result as PollResponse | null)?.title).toBe('Atualizado');
  });

  it('publish faz POST no endpoint correto', () => {
    const published = { ...mockPoll, status: 'SCHEDULED' as const };
    httpMock.post.mockReturnValue(of(published));
    let result: PollResponse | null = null;
    service.publish('poll-1').subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/publish'),
      {},
    );
    expect((result as PollResponse | null)?.status).toBe('SCHEDULED');
  });

  it('open faz POST no endpoint correto', () => {
    const opened = { ...mockPoll, status: 'OPEN' as const };
    httpMock.post.mockReturnValue(of(opened));
    let result: PollResponse | null = null;
    service.open('poll-1').subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/open'),
      {},
    );
    expect((result as PollResponse | null)?.status).toBe('OPEN');
  });

  it('cancel faz POST com reason no body', () => {
    const cancelled = { ...mockPoll, status: 'CANCELLED' as const, cancellationReason: 'Motivo teste' };
    httpMock.post.mockReturnValue(of(cancelled));
    let result: PollResponse | null = null;
    service.cancel('poll-1', { reason: 'Motivo teste' }).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/cancel'),
      { reason: 'Motivo teste' },
    );
    expect((result as PollResponse | null)?.cancellationReason).toBe('Motivo teste');
  });

  it('close faz POST no endpoint correto', () => {
    const closed = { ...mockPoll, status: 'CLOSED' as const };
    httpMock.post.mockReturnValue(of(closed));
    let result: PollResponse | null = null;
    service.close('poll-1').subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/close'),
      {},
    );
    expect((result as PollResponse | null)?.status).toBe('CLOSED');
  });

  it('getById faz GET no endpoint correto e retorna detail', () => {
    httpMock.get.mockReturnValue(of(mockDetail));
    let result: PollDetailResponse | null = null;
    service.getById('poll-1').subscribe((r) => (result = r));
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1'),
    );
    expect((result as PollDetailResponse | null)?.options).toHaveLength(1);
    expect((result as PollDetailResponse | null)?.result).toBeNull();
  });

  it('submitVote_callsCorrectEndpoint: faz POST no endpoint correto sem header X-Bulk-Operation quando bulkOperation=false', () => {
    const mockVote: VoteResponse = {
      id: 'vote-1',
      pollId: 'poll-1',
      apartmentId: 'apt-1',
      optionId: 'opt-1',
      votedAt: '2026-01-01T00:00:00Z',
    };
    httpMock.post.mockReturnValue(of(mockVote));
    let result: VoteResponse | null = null;
    service.submitVote('poll-1', 'apt-1', 'opt-1', false).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/vote'),
      { apartmentId: 'apt-1', optionId: 'opt-1' },
      { headers: {} },
    );
    const options = httpMock.post.mock.calls[0][2] as { headers: Record<string, string> };
    expect(options.headers['X-Bulk-Operation']).toBeUndefined();
    expect((result as VoteResponse | null)?.id).toBe('vote-1');
  });

  it('submitVote_withBulk_setsHeader: inclui header X-Bulk-Operation: true quando bulkOperation=true', () => {
    const mockVote: VoteResponse = {
      id: 'vote-2',
      pollId: 'poll-1',
      apartmentId: 'apt-2',
      optionId: 'opt-1',
      votedAt: '2026-01-01T00:00:00Z',
    };
    httpMock.post.mockReturnValue(of(mockVote));
    service.submitVote('poll-1', 'apt-2', 'opt-1', true).subscribe();
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/vote'),
      { apartmentId: 'apt-2', optionId: 'opt-1' },
      { headers: { 'X-Bulk-Operation': 'true' } },
    );
    const options = httpMock.post.mock.calls[0][2] as { headers: Record<string, string> };
    expect(options.headers['X-Bulk-Operation']).toBe('true');
  });

  it('getMyBallots_callsCorrectEndpoint: faz GET no endpoint correto e retorna MyBallotsResponse', () => {
    const mockBallots: MyBallotResponse[] = [
      { apartmentId: 'apt-1', apartmentLabel: '101', alreadyVoted: true, votedOptionId: 'opt-1' },
      { apartmentId: 'apt-2', apartmentLabel: '102', alreadyVoted: false, votedOptionId: null },
    ];
    const mockResponse = {
      ballots: mockBallots,
      excludedApartments: [],
      totalVotesSoFar: null,
      eligibleCount: 2,
    };
    httpMock.get.mockReturnValue(of(mockResponse));
    let result: typeof mockResponse | null = null;
    service.getMyBallots('poll-1').subscribe((r) => (result = r as typeof mockResponse));
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/polls/poll-1/my-ballots'),
    );
    expect(result!.ballots).toHaveLength(2);
    expect(result!.ballots[0].alreadyVoted).toBe(true);
    expect(result!.eligibleCount).toBe(2);
    expect(result!.totalVotesSoFar).toBeNull();
  });

  it('getMyPendingPolls_callsCorrectEndpoint: faz GET no endpoint correto e retorna polls pendentes', () => {
    const mockPending: MyPendingPollResponse[] = [
      {
        pollId: 'poll-1',
        title: 'Votação pendente',
        scheduledEnd: '2026-06-01T18:00:00Z',
        pendingBallotsCount: 3,
        totalBallotsCount: 10,
      },
    ];
    httpMock.get.mockReturnValue(of(mockPending));
    let result: ReadonlyArray<MyPendingPollResponse> | null = null;
    service.getMyPendingPolls('condo-1').subscribe((r) => (result = r));
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/my-pending-polls'),
    );
    expect((result as unknown as ReadonlyArray<MyPendingPollResponse>)).toHaveLength(1);
    expect((result as unknown as ReadonlyArray<MyPendingPollResponse>)[0].pendingBallotsCount).toBe(3);
  });
});
