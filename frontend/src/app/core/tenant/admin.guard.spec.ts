import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { adminGuard } from './admin.guard';
import { TenantService } from './tenant.service';

describe('adminGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  describe('usuário admin', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const tenant = TestBed.inject(TenantService);
      tenant.setActive('uuid-123', ['ADMIN']);
    });

    it('retorna true', () => {
      expect(runGuard()).toBe(true);
    });
  });

  describe('morador com tenant ativo', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const tenant = TestBed.inject(TenantService);
      tenant.setActive('uuid-123', ['OWNER']);
    });

    it('retorna UrlTree para /app/condominiums/:id', () => {
      const result = runGuard();
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/app/condominiums/uuid-123');
    });
  });

  describe('sem tenant ativo', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
    });

    it('retorna UrlTree para /app', () => {
      const result = runGuard();
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe('/app');
    });
  });
});
