import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type InvitationState =
  | 'VALID'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ALREADY_ACCEPTED';

export interface ValidateInvitationResponse {
  readonly state: InvitationState;
  readonly email: string | null;
  readonly apartmentLabel: string | null;
  readonly condominiumName: string | null;
  readonly role: 'OWNER' | 'TENANT' | null;
  readonly expiresAt: string | null;
}

export interface CompleteRegistrationRequest {
  readonly token: string;
  readonly cpf: string;
  readonly password: string;
  readonly fullName: string;
}

export interface CompleteRegistrationResponse {
  readonly userId: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly http = inject(HttpClient);

  validate(token: string): Observable<ValidateInvitationResponse> {
    return this.http.get<ValidateInvitationResponse>(
      `${environment.apiUrl}/api/public/invitations/validate`,
      { params: { token } },
    );
  }

  complete(request: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    return this.http.post<CompleteRegistrationResponse>(
      `${environment.apiUrl}/api/public/register/complete`,
      request,
    );
  }
}
