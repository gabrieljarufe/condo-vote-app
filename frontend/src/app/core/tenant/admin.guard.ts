import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from './tenant.service';

export const adminGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const router = inject(Router);
  const condoId = tenant.activeCondominiumId();
  if (tenant.isAdmin()) return true;
  if (condoId) return router.createUrlTree(['/app/condominiums', condoId]);
  return router.createUrlTree(['/app']);
};
