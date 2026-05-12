import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, ParamMap, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tenantRestoreGuard } from './tenant-restore.guard';
import { TenantService } from './tenant.service';
import { MeApiService, UserCondominium } from '../api/me-api.service';

const CONDO_ID = '019de5e8-a735-757a-a1bc-39af03edee05';

const mockCondo: UserCondominium = { id: CONDO_ID, name: 'Pitufos', roles: ['ADMIN'] };

function makeRoute(condoId: string): ActivatedRouteSnapshot {
  return {
    paramMap: { get: (k: string) => (k === 'condoId' ? condoId : null) } as ParamMap,
  } as unknown as ActivatedRouteSnapshot;
}

async function runGuard(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(() =>
    tenantRestoreGuard(route, {} as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

describe('tenantRestoreGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('condomínio já ativo (navegação normal)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: MeApiService, useValue: {} }],
      });
      TestBed.inject(TenantService).setActive(CONDO_ID, ['ADMIN']);
    });

    it('retorna true sem chamar a API', async () => {
      const result = await runGuard(makeRoute(CONDO_ID));
      expect(result).toBe(true);
    });
  });

  describe('F5 sem tenant ativo — condomínio acessível', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: MeApiService, useValue: { getCondominiums: () => of([mockCondo]) } },
        ],
      });
    });

    it('restaura o tenant e retorna true', async () => {
      const result = await runGuard(makeRoute(CONDO_ID));
      expect(result).toBe(true);
      expect(TestBed.inject(TenantService).activeCondominiumId()).toBe(CONDO_ID);
    });

    it('seta os roles corretos ao restaurar', async () => {
      await runGuard(makeRoute(CONDO_ID));
      expect(TestBed.inject(TenantService).activeRoles().has('ADMIN')).toBe(true);
    });
  });

  describe('F5 sem tenant ativo — condomínio inacessível', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: MeApiService, useValue: { getCondominiums: () => of([]) } },
        ],
      });
    });

    it('redireciona para /app quando user não tem acesso ao condoId', async () => {
      const result = await runGuard(makeRoute(CONDO_ID));
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/app');
    });
  });

  describe('F5 sem tenant ativo — API falha', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: MeApiService,
            useValue: { getCondominiums: () => throwError(() => new Error('network')) },
          },
        ],
      });
    });

    it('redireciona para /app em caso de erro de rede', async () => {
      const result = await runGuard(makeRoute(CONDO_ID));
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/app');
    });
  });
});
