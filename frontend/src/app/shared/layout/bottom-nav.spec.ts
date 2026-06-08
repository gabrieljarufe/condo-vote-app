import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { BottomNav } from './bottom-nav';

// Mesma limitação do app-header.spec.ts: signal inputs não recebem `setInput`
// de forma confiável em Vitest+JIT aqui, então testamos os computeds e o
// estado de "Mais" diretamente na instância.

function makeTenant(roles: string[], condoId: string | null = 'condo-1') {
  const roleSet = new Set(roles);
  return {
    activeCondominiumId: vi.fn(() => condoId),
    activeRoles: vi.fn(() => roleSet),
    isAdmin: vi.fn(() => roleSet.has('ADMIN')),
    isResident: vi.fn(() => roleSet.has('OWNER') || roleSet.has('TENANT')),
    hasActiveTenant: vi.fn(() => condoId !== null),
    setActive: vi.fn(),
    clear: vi.fn(),
  };
}

async function makeComponent(roles: string[], condoId: string | null = 'condo-1') {
  await TestBed.configureTestingModule({
    imports: [BottomNav],
    providers: [
      provideRouter([
        { path: 'login', children: [] },
        { path: 'app', children: [] },
      ]),
      { provide: TenantService, useValue: makeTenant(roles, condoId) },
      { provide: AuthService, useValue: { signOut: vi.fn().mockResolvedValue(undefined) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BottomNav);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fixture.componentInstance as any;
}

describe('BottomNav', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('links derivados do condo ativo', () => {
    it('homeLink aponta para o dashboard do condo', async () => {
      const c = await makeComponent(['OWNER']);
      expect(c.homeLink()).toBe('/app/condominiums/condo-1');
    });

    it('pollsLink e apartmentsLink usam o condo ativo', async () => {
      const c = await makeComponent(['ADMIN']);
      expect(c.pollsLink()).toBe('/app/condominiums/condo-1/polls');
      expect(c.apartmentsLink()).toBe('/app/condominiums/condo-1/apartments');
    });

    it('sem condo ativo, links de condo são null e homeLink cai para /app', async () => {
      const c = await makeComponent(['OWNER'], null);
      expect(c.homeLink()).toBe('/app');
      expect(c.pollsLink()).toBeNull();
      expect(c.apartmentsLink()).toBeNull();
    });
  });

  describe('chip de papel (reaproveita lógica do header)', () => {
    it('morador → "Proprietário"', async () => {
      const c = await makeComponent(['OWNER']);
      expect(c.roleChipLabel()).toBe('Proprietário');
    });

    it('híbrido ADMIN+OWNER → ordem canônica', async () => {
      const c = await makeComponent(['OWNER', 'ADMIN']);
      expect(c.roleChipLabel()).toBe('Síndico · Proprietário');
    });

    it('aria-label usa "e" como conjunção', async () => {
      const c = await makeComponent(['ADMIN', 'TENANT']);
      expect(c.roleChipAriaLabel()).toBe('Seus papéis neste condomínio: Síndico e Inquilino');
    });
  });

  describe('canSwitchCondo', () => {
    it('admin sempre pode trocar', async () => {
      const c = await makeComponent(['ADMIN']);
      expect(c.canSwitchCondo()).toBe(true);
    });

    it('morador com um único condo não troca', async () => {
      const c = await makeComponent(['OWNER']);
      expect(c.canSwitchCondo()).toBe(false);
    });
  });

  describe('"Mais" (bottom sheet)', () => {
    it('começa fechado e alterna com toggleMore', async () => {
      const c = await makeComponent(['OWNER']);
      expect(c.moreOpen()).toBe(false);
      c.toggleMore();
      expect(c.moreOpen()).toBe(true);
      c.toggleMore();
      expect(c.moreOpen()).toBe(false);
    });

    it('switchCondo fecha o sheet e limpa o tenant', async () => {
      const c = await makeComponent(['ADMIN']);
      const tenant = TestBed.inject(TenantService);
      c.toggleMore();
      c.switchCondo();
      expect(c.moreOpen()).toBe(false);
      expect(tenant.clear).toHaveBeenCalled();
    });

    it('signOut fecha o sheet, desloga e limpa o tenant', async () => {
      const c = await makeComponent(['OWNER']);
      const auth = TestBed.inject(AuthService);
      const tenant = TestBed.inject(TenantService);
      c.toggleMore();
      await c.signOut();
      expect(c.moreOpen()).toBe(false);
      expect(auth.signOut).toHaveBeenCalled();
      expect(tenant.clear).toHaveBeenCalled();
    });
  });
});
