import { Component, Input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink, provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { Spinner } from '../../shared/ui/spinner';
import Login, { isSafeRedirect } from './login';

let stubNextId = 0;

@Component({
  selector: 'app-form-field',
  template: '<label [for]="fieldId">{{ label }}</label><ng-content />',
  standalone: true,
})
class FormFieldStub {
  @Input() label = '';
  @Input() control: AbstractControl | null = null;
  @Input() errors: Record<string, string> = {};
  readonly fieldId = `ff-stub-${stubNextId++}`;
}

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

describe('Login — toggle ver senha', () => {
  afterEach(() => TestBed.resetTestingModule());

  const setup = async () => {
    const authMock = { signIn: vi.fn().mockResolvedValue(undefined) };
    const route = {
      snapshot: { queryParamMap: { get: () => null } },
    };
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: ActivatedRoute, useValue: route },
      ],
    })
      .overrideComponent(Login, {
        set: { imports: [ReactiveFormsModule, RouterLink, FormFieldStub, Spinner] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  };

  const getToggle = (fixture: ReturnType<typeof TestBed.createComponent>) =>
    fixture.nativeElement.querySelector(
      'button[aria-label="Mostrar senha"], button[aria-label="Ocultar senha"]',
    ) as HTMLButtonElement;

  const getPasswordInput = (fixture: ReturnType<typeof TestBed.createComponent>) =>
    fixture.nativeElement.querySelector(
      'input[formcontrolname="password"]',
    ) as HTMLInputElement;

  it('inicia mascarada (type=password) com aria-pressed=false', async () => {
    const fixture = await setup();
    expect(getPasswordInput(fixture).type).toBe('password');
    expect(getToggle(fixture).getAttribute('aria-pressed')).toBe('false');
    expect(getToggle(fixture).getAttribute('aria-label')).toBe('Mostrar senha');
  });

  it('clicar revela senha (type=text) e atualiza aria-pressed/label', async () => {
    const fixture = await setup();
    getToggle(fixture).click();
    fixture.detectChanges();
    expect(getPasswordInput(fixture).type).toBe('text');
    expect(getToggle(fixture).getAttribute('aria-pressed')).toBe('true');
    expect(getToggle(fixture).getAttribute('aria-label')).toBe('Ocultar senha');
  });

  it('segundo clique volta a mascarar', async () => {
    const fixture = await setup();
    getToggle(fixture).click();
    fixture.detectChanges();
    getToggle(fixture).click();
    fixture.detectChanges();
    expect(getPasswordInput(fixture).type).toBe('password');
    expect(getToggle(fixture).getAttribute('aria-pressed')).toBe('false');
  });
});
