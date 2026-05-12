import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MeApiService } from '../api/me-api.service';
import { TenantService } from './tenant.service';

/**
 * Restaura o tenant ativo a partir do :condoId na URL.
 *
 * Cenários:
 *  - Navegação normal (tenant já ativo e igual ao condoId): passa sem chamar API.
 *  - F5 / deep link (tenant vazio): busca /api/me/condominiums, seta o tenant e permite.
 *  - Sem acesso ao condoId ou erro de rede: redireciona para /app.
 */
export const tenantRestoreGuard: CanActivateFn = async (route) => {
  const condoId = route.paramMap.get('condoId');
  const tenant = inject(TenantService);
  const router = inject(Router);

  if (!condoId) return router.createUrlTree(['/app']);
  if (tenant.activeCondominiumId() === condoId) return true;

  try {
    const condos = await firstValueFrom(inject(MeApiService).getCondominiums());
    const match = condos.find((c) => c.id === condoId);
    if (!match) return router.createUrlTree(['/app']);
    tenant.setActive(match.id, match.roles);
    return true;
  } catch {
    return router.createUrlTree(['/app']);
  }
};
