import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Bloqueia rotas que exigem usuário autenticado.
 * Aguarda AuthService.initPromise para garantir que _session está populado
 * antes de qualquer guard/componente filho executar (corrige race condition no F5).
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.initPromise;

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
