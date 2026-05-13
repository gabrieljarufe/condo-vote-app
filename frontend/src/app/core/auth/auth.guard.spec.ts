import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(authenticated: boolean, initPromise: Promise<void> = Promise.resolve()) {
    const isAuthenticated = vi.fn(() => authenticated);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { initPromise, isAuthenticated } },
      ],
    });
    return { isAuthenticated };
  }

  function invokeGuard(url = '/app') {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as unknown as Promise<boolean | UrlTree>;
  }

  it('permite navegação quando usuário está autenticado', async () => {
    setup(true);
    expect(await invokeGuard()).toBe(true);
  });

  it('redireciona para /login com returnUrl quando não autenticado', async () => {
    setup(false);
    const result = await invokeGuard('/app/polls');
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Fapp%2Fpolls');
  });

  it('não chama isAuthenticated antes de initPromise resolver (race condition)', async () => {
    let resolveInit!: () => void;
    const pending = new Promise<void>((r) => { resolveInit = r; });
    const { isAuthenticated } = setup(true, pending);

    const resultPromise = invokeGuard();

    // guard ainda está aguardando initPromise — isAuthenticated não deve ter sido chamado
    expect(isAuthenticated).not.toHaveBeenCalled();

    resolveInit();
    await resultPromise;

    expect(isAuthenticated).toHaveBeenCalledOnce();
  });
});
