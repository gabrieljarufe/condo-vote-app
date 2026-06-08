import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import AuthenticatedShell from './authenticated-shell';

const CONDOS: UserCondominium[] = [
  { id: 'condo-1', name: 'Edifício Bossa', roles: ['ADMIN'] },
];

function configure(getCondominiums: () => unknown) {
  return TestBed.configureTestingModule({
    imports: [AuthenticatedShell],
    providers: [
      provideRouter([]),
      { provide: MeApiService, useValue: { getCondominiums: vi.fn(getCondominiums) } },
      {
        provide: TenantService,
        useValue: {
          activeCondominiumId: vi.fn(() => 'condo-1'),
          activeRoles: vi.fn(() => new Set(['ADMIN'])),
          isAdmin: vi.fn(() => true),
          isResident: vi.fn(() => false),
          hasActiveTenant: vi.fn(() => true),
          setActive: vi.fn(),
          clear: vi.fn(),
        },
      },
      { provide: AuthService, useValue: { signOut: vi.fn().mockResolvedValue(undefined) } },
    ],
  }).compileComponents();
}

describe('AuthenticatedShell', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza header, router-outlet e bottom-nav', async () => {
    await configure(() => of(CONDOS));
    const fixture = TestBed.createComponent(AuthenticatedShell);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-app-header')).not.toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-bottom-nav')).not.toBeNull();
  });

  it('carrega os condomínios e os expõe via condos()', async () => {
    await configure(() => of(CONDOS));
    const fixture = TestBed.createComponent(AuthenticatedShell);
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((fixture.componentInstance as any).condos()).toEqual(CONDOS);
  });

  it('em erro de carregamento, condos() cai para lista vazia (sem quebrar)', async () => {
    await configure(() => throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(AuthenticatedShell);
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((fixture.componentInstance as any).condos()).toEqual([]);
  });
});
