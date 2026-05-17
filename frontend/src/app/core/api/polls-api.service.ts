import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from './apartments-api.service';

export type { Page };

export interface PollResponse {
  readonly id: string;
  readonly condominiumId: string;
  readonly title: string;
  readonly description: string | null;
  readonly convocation: 'FIRST' | 'SECOND';
  readonly quorumMode: 'SIMPLE_MAJORITY' | 'ABSOLUTE_MAJORITY' | 'QUALIFIED_2_3' | 'QUALIFIED_3_4';
  readonly status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'INVALIDATED' | 'CANCELLED';
  readonly scheduledStart: string;
  readonly scheduledEnd: string;
  readonly openedAt: string | null;
  readonly eligibleCount: number | null;
  readonly closedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
}

export interface PollOptionResponse {
  readonly id: string;
  readonly label: string;
  readonly displayOrder: number;
}

export interface PollResultResponse {
  readonly totalVotes: number;
  readonly winningOptionId: string | null;
  readonly quorumReached: boolean;
  readonly closeTrigger: string;
  readonly invalidationReason: string | null;
  readonly determinedAt: string;
  readonly optionsBreakdown: string;
}

export interface PollDetailResponse {
  readonly poll: PollResponse;
  readonly options: ReadonlyArray<PollOptionResponse>;
  readonly result: PollResultResponse | null;
}

export interface CreatePollRequest {
  readonly title: string;
  readonly description?: string;
  readonly convocation: 'FIRST' | 'SECOND';
  readonly quorumMode: 'SIMPLE_MAJORITY' | 'ABSOLUTE_MAJORITY' | 'QUALIFIED_2_3' | 'QUALIFIED_3_4';
  readonly scheduledStart: string;
  readonly scheduledEnd: string;
  readonly options: ReadonlyArray<string>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdatePollRequest extends CreatePollRequest {}


export interface CancelPollRequest {
  readonly reason: string;
}

export interface VoteResponse {
  readonly id: string;
  readonly pollId: string;
  readonly apartmentId: string;
  readonly optionId: string;
  readonly votedAt: string;
}

export interface MyBallotResponse {
  readonly apartmentId: string;
  readonly apartmentLabel: string;
  readonly alreadyVoted: boolean;
  readonly votedOptionId: string | null;
}

export interface MyPendingPollResponse {
  readonly pollId: string;
  readonly title: string;
  readonly scheduledEnd: string;
  readonly pendingBallotsCount: number;
  readonly totalBallotsCount: number;
}

@Injectable({ providedIn: 'root' })
export class PollsApiService {
  private readonly http = inject(HttpClient);

  list(condoId: string, status?: string, page = 0, size = 10): Observable<Page<PollResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Page<PollResponse>>(
      `${environment.apiUrl}/api/condominiums/${condoId}/polls`,
      { params },
    );
  }

  create(condoId: string, request: CreatePollRequest): Observable<PollResponse> {
    return this.http.post<PollResponse>(
      `${environment.apiUrl}/api/condominiums/${condoId}/polls`,
      request,
    );
  }

  update(pollId: string, request: UpdatePollRequest): Observable<PollResponse> {
    return this.http.put<PollResponse>(
      `${environment.apiUrl}/api/polls/${pollId}`,
      request,
    );
  }

  publish(pollId: string): Observable<PollResponse> {
    return this.http.post<PollResponse>(
      `${environment.apiUrl}/api/polls/${pollId}/publish`,
      {},
    );
  }

  open(pollId: string): Observable<PollResponse> {
    return this.http.post<PollResponse>(
      `${environment.apiUrl}/api/polls/${pollId}/open`,
      {},
    );
  }

  cancel(pollId: string, request: CancelPollRequest): Observable<PollResponse> {
    return this.http.post<PollResponse>(
      `${environment.apiUrl}/api/polls/${pollId}/cancel`,
      request,
    );
  }

  close(pollId: string): Observable<PollResponse> {
    return this.http.post<PollResponse>(
      `${environment.apiUrl}/api/polls/${pollId}/close`,
      {},
    );
  }

  getById(pollId: string): Observable<PollDetailResponse> {
    return this.http.get<PollDetailResponse>(
      `${environment.apiUrl}/api/polls/${pollId}`,
    );
  }

  submitVote(
    pollId: string,
    apartmentId: string,
    optionId: string,
    bulkOperation: boolean,
  ): Observable<VoteResponse> {
    const headers = bulkOperation ? { 'X-Bulk-Operation': 'true' } : {};
    return this.http.post<VoteResponse>(
      `${environment.apiUrl}/api/polls/${pollId}/vote`,
      { apartmentId, optionId },
      { headers },
    );
  }

  getMyBallots(pollId: string): Observable<ReadonlyArray<MyBallotResponse>> {
    return this.http.get<ReadonlyArray<MyBallotResponse>>(
      `${environment.apiUrl}/api/polls/${pollId}/my-ballots`,
    );
  }

  getMyPendingPolls(condoId: string): Observable<ReadonlyArray<MyPendingPollResponse>> {
    return this.http.get<ReadonlyArray<MyPendingPollResponse>>(
      `${environment.apiUrl}/api/condominiums/${condoId}/my-pending-polls`,
    );
  }
}
