import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tenantGuard } from './tenant.guard';
import { TenantService } from './tenant.service';

describe('tenantGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      tenantGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  describe('sem condomínio ativo', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
    });

    it('retorna UrlTree para /app', () => {
      const result = runGuard();
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/app');
    });
  });

  describe('com condomínio ativo', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const tenant = TestBed.inject(TenantService);
      tenant.setActive('uuid-123', ['ADMIN']);
    });

    it('retorna true', () => {
      expect(runGuard()).toBe(true);
    });
  });
});
