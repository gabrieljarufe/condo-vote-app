import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Apartment {
  readonly id: string;
  readonly condominiumId: string;
  readonly unitNumber: string;
  readonly block: string | null;
  readonly isDelinquent: boolean;
  readonly eligibleVoterUserId: string | null;
  readonly createdAt: string;
}

export interface CreateApartmentRequest {
  readonly unitNumber: string;
  readonly block?: string;
}

@Injectable({ providedIn: 'root' })
export class ApartmentsApiService {
  private readonly http = inject(HttpClient);

  list(condominiumId: string): Observable<Apartment[]> {
    return this.http.get<Apartment[]>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/apartments`,
    );
  }

  create(condominiumId: string, request: CreateApartmentRequest): Observable<Apartment> {
    return this.http.post<Apartment>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/apartments`,
      request,
    );
  }

  setDelinquent(id: string, isDelinquent: boolean): Observable<Apartment> {
    return this.http.patch<Apartment>(
      `${environment.apiUrl}/api/apartments/${id}/delinquent`,
      { isDelinquent },
    );
  }
}
