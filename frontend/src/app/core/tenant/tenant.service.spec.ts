import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TenantService);
  });

  it('setActive armazena id e roles', () => {
    service.setActive('condo-1', ['ADMIN']);
    expect(service.activeCondominiumId()).toBe('condo-1');
  });

  it('activeCondominiumId computa corretamente', () => {
    expect(service.activeCondominiumId()).toBeNull();
    service.setActive('condo-2', ['OWNER']);
    expect(service.activeCondominiumId()).toBe('condo-2');
  });

  it('activeRoles retorna Set com os papéis', () => {
    service.setActive('condo-1', ['ADMIN']);
    const roles = service.activeRoles();
    expect(roles.has('ADMIN')).toBe(true);
  });

  it('activeRoles contém todos os papéis quando múltiplos', () => {
    service.setActive('condo-1', ['ADMIN', 'OWNER']);
    const roles = service.activeRoles();
    expect(roles.size).toBe(2);
    expect(roles.has('ADMIN')).toBe(true);
    expect(roles.has('OWNER')).toBe(true);
  });

  it('clear zera o estado', () => {
    service.setActive('condo-1', ['ADMIN']);
    service.clear();
    expect(service.activeCondominiumId()).toBeNull();
    expect(service.activeRoles().size).toBe(0);
  });

  describe('isAdmin', () => {
    it('é true quando role é ADMIN', () => {
      service.setActive('condo-1', ['ADMIN']);
      expect(service.isAdmin()).toBe(true);
    });

    it('é false quando role é OWNER', () => {
      service.setActive('condo-1', ['OWNER']);
      expect(service.isAdmin()).toBe(false);
    });

    it('é false quando role é TENANT', () => {
      service.setActive('condo-1', ['TENANT']);
      expect(service.isAdmin()).toBe(false);
    });

    it('é false quando não há tenant ativo', () => {
      expect(service.isAdmin()).toBe(false);
    });
  });

  describe('isResident', () => {
    it('é true para OWNER', () => {
      service.setActive('condo-1', ['OWNER']);
      expect(service.isResident()).toBe(true);
    });

    it('é true para TENANT', () => {
      service.setActive('condo-1', ['TENANT']);
      expect(service.isResident()).toBe(true);
    });

    it('é false quando role é somente ADMIN', () => {
      service.setActive('condo-1', ['ADMIN']);
      expect(service.isResident()).toBe(false);
    });

    it('é false quando não há tenant ativo', () => {
      expect(service.isResident()).toBe(false);
    });
  });

  describe('hasActiveTenant', () => {
    it('é false antes de setActive', () => {
      expect(service.hasActiveTenant()).toBe(false);
    });

    it('é true depois de setActive', () => {
      service.setActive('condo-1', ['ADMIN']);
      expect(service.hasActiveTenant()).toBe(true);
    });

    it('é false após clear()', () => {
      service.setActive('condo-1', ['ADMIN']);
      service.clear();
      expect(service.hasActiveTenant()).toBe(false);
    });
  });
});
