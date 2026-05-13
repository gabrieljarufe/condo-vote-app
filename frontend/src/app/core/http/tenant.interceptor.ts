import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '../tenant/tenant.service';
import { environment } from '../../../environments/environment';

/**
 * Injeta `X-Tenant-Id: <activeCondominiumId>` em requests ao backend.
 *
 * Exclusões (cross-tenant — usuário ainda não escolheu um condomínio):
 *   - /api/me/**       (perfil global do usuário, lista de condomínios)
 *   - /api/register/** (auto-cadastro / convites públicos)
 *
 * Sem condomínio ativo → não injeta. Endpoints tenant-bound rejeitam (400).
 */
const TENANT_EXCLUDED_PREFIXES = ['/api/me/', '/api/register/'];

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const path = req.url.slice(environment.apiUrl.length);
  const isExcluded = TENANT_EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isExcluded) {
    return next(req);
  }

  const tenantId = inject(TenantService).activeCondominiumId();
  if (!tenantId) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { 'X-Tenant-Id': tenantId },
    }),
  );
};
