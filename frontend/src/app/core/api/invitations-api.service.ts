import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | 'BOUNCED';
export type InvitationRole = 'OWNER' | 'TENANT';

export interface Invitation {
  readonly id: string;
  readonly apartmentId: string;
  readonly email: string;
  readonly role: InvitationRole;
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly createdAt: string;
}

export interface CreateInvitationRequest {
  readonly apartmentId: string;
  readonly email: string;
  readonly cpf: string;
  readonly role: InvitationRole;
}

export interface BulkInvitationEntry {
  readonly email: string;
  readonly cpf: string;
  readonly block: string | null;
  readonly unitNumber: string;
  readonly role: InvitationRole;
}

export interface BulkCreateRequest {
  readonly entries: ReadonlyArray<BulkInvitationEntry>;
}

export interface BulkRowError {
  readonly rowIndex: number;
  readonly field: string;
  readonly message: string;
}

export interface BulkResultResponse {
  readonly created: number;
  readonly invitations: ReadonlyArray<Invitation>;
  readonly errors: ReadonlyArray<BulkRowError>;
}

export interface FixEmailRequest {
  readonly newEmail: string;
}

@Injectable({ providedIn: 'root' })
export class InvitationsApiService {
  private readonly http = inject(HttpClient);

  list(
    condominiumId: string,
    filters?: { apartmentId?: string; status?: InvitationStatus },
  ): Observable<Invitation[]> {
    let params = new HttpParams();
    if (filters?.apartmentId) params = params.set('apartmentId', filters.apartmentId);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<Invitation[]>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/invitations`,
      { params },
    );
  }

  create(condominiumId: string, request: CreateInvitationRequest): Observable<Invitation> {
    return this.http.post<Invitation>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/invitations`,
      request,
    );
  }

  createBulk(condominiumId: string, request: BulkCreateRequest): Observable<BulkResultResponse> {
    return this.http.post<BulkResultResponse>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/invitations/bulk`,
      request,
    );
  }

  resend(invitationId: string): Observable<Invitation> {
    return this.http.post<Invitation>(
      `${environment.apiUrl}/api/invitations/${invitationId}/resend`,
      {},
    );
  }

  revoke(invitationId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/api/invitations/${invitationId}/revoke`,
      {},
    );
  }

  fixEmail(invitationId: string, request: FixEmailRequest): Observable<Invitation> {
    return this.http.post<Invitation>(
      `${environment.apiUrl}/api/invitations/${invitationId}/fix-email`,
      request,
    );
  }
}
