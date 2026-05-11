import { Injectable, computed, signal } from '@angular/core';
import { UserRoleInCondo } from '../api/me-api.service';

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
  private static readonly EMPTY_ROLES: ReadonlySet<UserRoleInCondo> = new Set();

  private readonly _active = signal<{ id: string; roles: ReadonlySet<UserRoleInCondo> } | null>(null);

  readonly activeCondominiumId = computed(() => this._active()?.id ?? null);
  readonly activeRoles = computed<ReadonlySet<UserRoleInCondo>>(
    () => this._active()?.roles ?? TenantService.EMPTY_ROLES
  );

  setActive(id: string, roles: readonly UserRoleInCondo[]): void {
    this._active.set({ id, roles: new Set(roles) });
  }

  clear(): void {
    this._active.set(null);
  }
}
