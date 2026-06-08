import { describe, it, expect } from 'vitest';
import { UserRoleInCondo } from '../../core/api/me-api.service';
import { getOrderedRoles, getRoleChipAriaLabel, getRoleChipLabel } from './role-chip';

const set = (...roles: UserRoleInCondo[]): ReadonlySet<UserRoleInCondo> => new Set(roles);

describe('role-chip helper', () => {
  describe('getOrderedRoles', () => {
    it('mantém ordem canônica ADMIN → OWNER → TENANT independente da ordem no Set', () => {
      expect(getOrderedRoles(set('TENANT', 'OWNER', 'ADMIN'))).toEqual(['ADMIN', 'OWNER', 'TENANT']);
    });

    it('filtra apenas papéis presentes', () => {
      expect(getOrderedRoles(set('OWNER'))).toEqual(['OWNER']);
    });

    it('sem papéis → array vazio', () => {
      expect(getOrderedRoles(set())).toEqual([]);
    });
  });

  describe('getRoleChipLabel', () => {
    it('OWNER apenas → "Proprietário"', () => {
      expect(getRoleChipLabel(set('OWNER'))).toBe('Proprietário');
    });

    it('ADMIN apenas → "Síndico"', () => {
      expect(getRoleChipLabel(set('ADMIN'))).toBe('Síndico');
    });

    it('TENANT apenas → "Inquilino"', () => {
      expect(getRoleChipLabel(set('TENANT'))).toBe('Inquilino');
    });

    it('ADMIN + OWNER → "Síndico · Proprietário" (ordem canônica, separador ·)', () => {
      expect(getRoleChipLabel(set('OWNER', 'ADMIN'))).toBe('Síndico · Proprietário');
    });

    it('ADMIN + TENANT → "Síndico · Inquilino"', () => {
      expect(getRoleChipLabel(set('TENANT', 'ADMIN'))).toBe('Síndico · Inquilino');
    });

    it('três papéis → "Síndico · Proprietário · Inquilino"', () => {
      expect(getRoleChipLabel(set('TENANT', 'ADMIN', 'OWNER'))).toBe(
        'Síndico · Proprietário · Inquilino',
      );
    });

    it('sem papéis → null', () => {
      expect(getRoleChipLabel(set())).toBeNull();
    });
  });

  describe('getRoleChipAriaLabel', () => {
    it('1 papel → "Seus papéis neste condomínio: Síndico"', () => {
      expect(getRoleChipAriaLabel(set('ADMIN'))).toBe('Seus papéis neste condomínio: Síndico');
    });

    it('2 papéis → usa "e" como conjunção, não "·"', () => {
      expect(getRoleChipAriaLabel(set('ADMIN', 'OWNER'))).toBe(
        'Seus papéis neste condomínio: Síndico e Proprietário',
      );
    });

    it('ADMIN + TENANT → "Síndico e Inquilino"', () => {
      expect(getRoleChipAriaLabel(set('ADMIN', 'TENANT'))).toBe(
        'Seus papéis neste condomínio: Síndico e Inquilino',
      );
    });

    it('3 papéis → "Síndico, Proprietário e Inquilino" (vírgula + e final)', () => {
      expect(getRoleChipAriaLabel(set('ADMIN', 'OWNER', 'TENANT'))).toBe(
        'Seus papéis neste condomínio: Síndico, Proprietário e Inquilino',
      );
    });

    it('sem papéis → null', () => {
      expect(getRoleChipAriaLabel(set())).toBeNull();
    });
  });
});
