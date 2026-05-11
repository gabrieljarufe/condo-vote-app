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
});
