import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Injeta `Authorization: Bearer <jwt>` em requests para o backend Condo Vote.
 *
 * Só atua em URLs que começam com `environment.apiUrl` — evita vazar token
 * para terceiros (CDN de imagem, GoTrue do Supabase, etc.).
 *
 * Refresh é delegado ao Supabase SDK; em 401, deixa passar e o guard redireciona.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const token = inject(AuthService).accessToken();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
