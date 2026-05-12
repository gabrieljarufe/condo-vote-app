import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from './tenant.service';

/**
 * Bloqueia rotas que exigem condomínio selecionado.
 * Sem seleção → redireciona para /app (Home) onde o usuário escolhe.
 *
 * USO em home.routes.ts ao adicionar rotas condo-específicas:
 *   { path: 'polls', canActivate: [tenantGuard], loadComponent: () => import('../polls/polls') }
 */
export const tenantGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const router = inject(Router);

  if (tenant.activeCondominiumId() !== null) return true;
  return router.createUrlTree(['/app']);
};
