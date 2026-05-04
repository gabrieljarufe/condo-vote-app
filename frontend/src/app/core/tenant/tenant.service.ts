import { Injectable, signal } from '@angular/core';

/**
 * Mantém o condomínio ativo da sessão atual.
 *
 * IMPORTANTE: estado em **memória** apenas. Sem localStorage (decisão
 * documentada em architecture.md §6 e phase-4-frontend-skeleton.md T4.3).
 * Reset no refresh é intencional — força nova seleção explícita após F5,
 * evita ambiguidade entre tenants quando o usuário tem múltiplos condomínios.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly _activeCondominiumId = signal<string | null>(null);
  readonly activeCondominiumId = this._activeCondominiumId.asReadonly();

  setActive(condominiumId: string): void {
    this._activeCondominiumId.set(condominiumId);
  }

  clear(): void {
    this._activeCondominiumId.set(null);
  }
}
