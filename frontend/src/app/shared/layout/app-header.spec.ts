import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from './app-header';

// Limitação conhecida (ver apartment-bulk-preview-grid.spec.ts:73-76):
// `setInput` e `[binding]` em template-host não funcionam com signal inputs
// em Vitest+JIT neste projeto. Por isso testamos os computeds de papel
// diretamente na instância — a renderização do chip é `{{ label }}` simples,
// já coberta visualmente em smoke test manual.

function makeTenant(roles: string[]) {
  const roleSet = new Set(roles);
  return {
    activeCondominiumId: vi.fn(() => 'condo-1'),
    activeRoles: vi.fn(() => roleSet),
    isAdmin: vi.fn(() => roleSet.has('ADMIN')),
    isResident: vi.fn(() => roleSet.has('OWNER') || roleSet.has('TENANT')),
    hasActiveTenant: vi.fn(() => true),
    setActive: vi.fn(),
    clear: vi.fn(),
  };
}

async function makeComponent(roles: string[]) {
  await TestBed.configureTestingModule({
    imports: [AppHeader],
    providers: [
      provideRouter([]),
      { provide: TenantService, useValue: makeTenant(roles) },
      { provide: AuthService, useValue: { signOut: vi.fn().mockResolvedValue(undefined) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AppHeader);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fixture.componentInstance as any;
}

describe('AppHeader — chip de papel composto', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('roleChipLabel (texto visual)', () => {
    it('OWNER apenas → "Proprietário"', async () => {
      const c = await makeComponent(['OWNER']);
      expect(c.roleChipLabel()).toBe('Proprietário');
    });

    it('ADMIN apenas → "Síndico"', async () => {
      const c = await makeComponent(['ADMIN']);
      expect(c.roleChipLabel()).toBe('Síndico');
    });

    it('TENANT apenas → "Inquilino"', async () => {
      const c = await makeComponent(['TENANT']);
      expect(c.roleChipLabel()).toBe('Inquilino');
    });

    it('ADMIN + OWNER → "Síndico · Proprietário" (ordem canônica)', async () => {
      // Ordem da inserção no Set não importa — ordem canônica ADMIN→OWNER→TENANT.
      const c = await makeComponent(['OWNER', 'ADMIN']);
      expect(c.roleChipLabel()).toBe('Síndico · Proprietário');
    });

    it('ADMIN + TENANT → "Síndico · Inquilino"', async () => {
      const c = await makeComponent(['TENANT', 'ADMIN']);
      expect(c.roleChipLabel()).toBe('Síndico · Inquilino');
    });

    it('sem papéis → null (chip não renderiza)', async () => {
      const c = await makeComponent([]);
      expect(c.roleChipLabel()).toBeNull();
    });
  });

  describe('roleChipAriaLabel (rótulo para leitor de tela)', () => {
    it('1 papel → "Seus papéis neste condomínio: Síndico"', async () => {
      const c = await makeComponent(['ADMIN']);
      expect(c.roleChipAriaLabel()).toBe('Seus papéis neste condomínio: Síndico');
    });

    it('2 papéis → usa "e" como conjunção natural, não "·"', async () => {
      const c = await makeComponent(['ADMIN', 'OWNER']);
      expect(c.roleChipAriaLabel()).toBe(
        'Seus papéis neste condomínio: Síndico e Proprietário',
      );
    });

    it('ADMIN + TENANT → "Síndico e Inquilino"', async () => {
      const c = await makeComponent(['ADMIN', 'TENANT']);
      expect(c.roleChipAriaLabel()).toBe(
        'Seus papéis neste condomínio: Síndico e Inquilino',
      );
    });

    it('sem papéis → null', async () => {
      const c = await makeComponent([]);
      expect(c.roleChipAriaLabel()).toBeNull();
    });
  });

  describe('orderedRoles', () => {
    it('mantém ordem ADMIN → OWNER → TENANT independente da ordem no Set', async () => {
      const c = await makeComponent(['TENANT', 'OWNER', 'ADMIN']);
      expect(c.orderedRoles()).toEqual(['ADMIN', 'OWNER', 'TENANT']);
    });

    it('filtra apenas papéis presentes', async () => {
      const c = await makeComponent(['OWNER']);
      expect(c.orderedRoles()).toEqual(['OWNER']);
    });
  });
});
