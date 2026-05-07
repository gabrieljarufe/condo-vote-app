import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Resposta de GET /api/me/condominiums.
 * Espelha CondominiumSummary do backend (UserRoleInCondo enum).
 *   ADMIN    — síndico/admin do condomínio
 *   OWNER    — proprietário de unidade
 *   TENANT   — inquilino
 *   MULTIPLE — usuário tem mais de um vínculo no mesmo condomínio (raro)
 */
export type UserRoleInCondo = 'ADMIN' | 'OWNER' | 'TENANT' | 'MULTIPLE';

export interface UserCondominium {
  readonly id: string;
  readonly name: string;
  readonly role: UserRoleInCondo;
}

/**
 * Endpoints cross-tenant do usuário autenticado.
 * Vivem em core/api/ (não em features/) porque não pertencem a um aggregate
 * de domínio único — são metadados do usuário através de todos os condomínios.
 */
@Injectable({ providedIn: 'root' })
export class MeApiService {
  private readonly http = inject(HttpClient);

  getCondominiums(): Observable<UserCondominium[]> {
    return this.http.get<UserCondominium[]>(`${environment.apiUrl}/api/me/condominiums`);
  }
}
