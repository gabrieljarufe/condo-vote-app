import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Page<T> {
  readonly content: ReadonlyArray<T>;
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

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

export interface BatchCreateRequest {
  readonly items: ReadonlyArray<CreateApartmentRequest>;
}

export interface SkippedItem {
  readonly unitNumber: string;
  readonly block: string | null;
  readonly reason: 'DUPLICATE';
}

export interface BatchCreateResponse {
  readonly created: ReadonlyArray<Apartment>;
  readonly skipped: ReadonlyArray<SkippedItem>;
}

@Injectable({ providedIn: 'root' })
export class ApartmentsApiService {
  private readonly http = inject(HttpClient);

  list(condominiumId: string, page = 0, size = 10): Observable<Page<Apartment>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<Apartment>>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/apartments`,
      { params },
    );
  }

  create(condominiumId: string, request: CreateApartmentRequest): Observable<Apartment> {
    return this.http.post<Apartment>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/apartments`,
      request,
    );
  }

  createBatch(condominiumId: string, request: BatchCreateRequest): Observable<BatchCreateResponse> {
    return this.http.post<BatchCreateResponse>(
      `${environment.apiUrl}/api/condominiums/${condominiumId}/apartments/batch`,
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
