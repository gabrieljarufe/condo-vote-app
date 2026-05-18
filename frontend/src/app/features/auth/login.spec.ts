import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import Login, { isSafeRedirect } from './login';

describe('Login — isSafeRedirect', () => {
  it('aceita path interno começando com /', () => {
    expect(isSafeRedirect('/invite/abc123')).toBe(true);
    expect(isSafeRedirect('/app')).toBe(true);
  });

  it('rejeita null e vazio', () => {
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect('')).toBe(false);
  });

  it('rejeita URLs absolutas', () => {
    expect(isSafeRedirect('https://evil.com')).toBe(false);
    // eslint-disable-next-line sonarjs/no-clear-text-protocols
    expect(isSafeRedirect('http://evil.com')).toBe(false);
  });

  it('rejeita URL protocol-relative (//evil.com)', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false);
  });

  it('rejeita paths relativos sem barra inicial', () => {
    expect(isSafeRedirect('invite/abc123')).toBe(false);
  });
});

describe('Login — submit com redirect', () => {
  afterEach(() => TestBed.resetTestingModule());

  const setup = async (params: Record<string, string>) => {
    const authMock = { signIn: vi.fn().mockResolvedValue(undefined) };
    const route = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => params[key] ?? null,
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(Login);
    const component = fixture.componentInstance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).form.setValue({ email: 'user@example.com', password: 'senha-forte-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (component as any).submit();

    return { navigateSpy, authMock };
  };

  it('navega para o redirect seguro quando informado', async () => {
    const { navigateSpy } = await setup({ redirect: '/invite/abc123' });
    expect(navigateSpy).toHaveBeenCalledWith('/invite/abc123');
  });

  it('ignora redirect absoluto (https://evil.com) e usa default /app', async () => {
    const { navigateSpy } = await setup({ redirect: 'https://evil.com' });
    expect(navigateSpy).toHaveBeenCalledWith('/app');
  });

  it('ignora redirect protocol-relative (//evil.com) e usa default /app', async () => {
    const { navigateSpy } = await setup({ redirect: '//evil.com' });
    expect(navigateSpy).toHaveBeenCalledWith('/app');
  });

  it('sem redirect e sem returnUrl, navega para /app (comportamento default)', async () => {
    const { navigateSpy } = await setup({});
    expect(navigateSpy).toHaveBeenCalledWith('/app');
  });

  it('sem redirect mas com returnUrl, preserva comportamento original', async () => {
    const { navigateSpy } = await setup({ returnUrl: '/app/condominiums' });
    expect(navigateSpy).toHaveBeenCalledWith('/app/condominiums');
  });
});
