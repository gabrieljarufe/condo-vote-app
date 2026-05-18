import { Component, Input, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  CompleteRegistrationResponse,
  OnboardingApiService,
  ValidateInvitationResponse,
} from '../../core/api/onboarding-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Spinner } from '../../shared/ui/spinner';
import InvitationAcceptPage from './invitation-accept-page';

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

function activatedRouteWith(token: string | null): Partial<ActivatedRoute> {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => (key === 'token' ? token : null),
      },
    } as unknown as ActivatedRoute['snapshot'],
  };
}

function makeSession(email: string): Session {
  return {
    access_token: 'tok',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'u1', email, app_metadata: {}, user_metadata: {}, aud: 'authenticated' },
  } as unknown as Session;
}

const validResponse: ValidateInvitationResponse = {
  state: 'VALID',
  email: 'morador@exemplo.com',
  apartmentLabel: 'Bloco A · Apto 101',
  condominiumName: 'Edifício Teste',
  role: 'OWNER',
  expiresAt: '2026-12-01T00:00:00Z',
  emailHasAccount: false,
};

async function setup(
  apiOverrides: Partial<OnboardingApiService>,
  options: { token?: string | null; session?: Session | null } = {},
) {
  const sessionSignal = signal<Session | null>(options.session ?? null);
  const authStub = {
    session: sessionSignal.asReadonly(),
    signOut: vi.fn(async () => undefined),
  };
  await TestBed.configureTestingModule({
    imports: [InvitationAcceptPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: OnboardingApiService, useValue: apiOverrides },
      { provide: AuthService, useValue: authStub },
      { provide: ActivatedRoute, useValue: activatedRouteWith(options.token ?? 'tok-abc') },
    ],
  })
    .overrideComponent(InvitationAcceptPage, {
      set: { imports: [FormFieldStub, Spinner, ReactiveFormsModule] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(InvitationAcceptPage);
  fixture.detectChanges();
  return { fixture, authStub };
}

describe('InvitationAcceptPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza modo CREATE quando emailHasAccount=false', async () => {
    const api = { validate: vi.fn(() => of(validResponse)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);
    expect(api.validate).toHaveBeenCalledWith('tok-abc');
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Edifício Teste');
    expect(html).toContain('Bloco A · Apto 101');
    expect(html).toContain('Criar conta');
  });

  it('CREATE: submete com acceptanceConfirmed=true e redireciona para /login?registered=1', async () => {
    const completeResp: CompleteRegistrationResponse = { userId: 'user-new' };
    const api = {
      validate: vi.fn(() => of(validResponse)),
      complete: vi.fn(() => of(completeResp)),
    };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const cmp = fixture.componentInstance as unknown as {
      form: {
        patchValue: (v: Record<string, unknown>) => void;
        invalid: boolean;
      };
      submit: () => void;
    };
    cmp.form.patchValue({
      fullName: 'Morador Teste',
      cpf: '111.444.777-35',
      password: 'senha-forte-1',
      confirmPassword: 'senha-forte-1',
      acceptanceConfirmed: true,
    });
    cmp.submit();

    expect(api.complete).toHaveBeenCalledTimes(1);
    expect(api.complete).toHaveBeenCalledWith(
      expect.objectContaining({ acceptanceConfirmed: true }),
    );
    expect(navSpy).toHaveBeenCalledWith(['/login'], { queryParams: { registered: '1' } });
  });

  it('CREATE: sem checkbox marcado o form é inválido', async () => {
    const api = { validate: vi.fn(() => of(validResponse)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);
    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue: (v: Record<string, unknown>) => void; invalid: boolean };
    };
    cmp.form.patchValue({
      fullName: 'Morador Teste',
      cpf: '111.444.777-35',
      password: 'senha-forte-1',
      confirmPassword: 'senha-forte-1',
      acceptanceConfirmed: false,
    });
    expect(cmp.form.invalid).toBe(true);
  });

  it('mostra erro quando backend devolve 400 (CPF)', async () => {
    const api = {
      validate: vi.fn(() => of(validResponse)),
      complete: vi.fn(() =>
        throwError(() => ({ status: 400, error: { message: 'CPF não confere com o convite' } })),
      ),
    };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);

    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue: (v: Record<string, unknown>) => void };
      submit: () => void;
    };
    cmp.form.patchValue({
      fullName: 'Morador Teste',
      cpf: '999.999.999-99',
      password: 'senha-forte-1',
      confirmPassword: 'senha-forte-1',
      acceptanceConfirmed: true,
    });
    cmp.submit();
    fixture.detectChanges();

    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('CPF não confere');
  });

  it('LOGIN_REQUIRED: emailHasAccount=true e sem sessão', async () => {
    const resp: ValidateInvitationResponse = { ...validResponse, emailHasAccount: true };
    const api = { validate: vi.fn(() => of(resp)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>, {
      session: null,
    });
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Já existe uma conta');
    expect(html).toContain('Entrar');
  });

  it('LINK: emailHasAccount=true e sessão com mesmo e-mail (case-insensitive); submitLink chama acceptAsExisting', async () => {
    const resp: ValidateInvitationResponse = { ...validResponse, emailHasAccount: true };
    const api = {
      validate: vi.fn(() => of(resp)),
      complete: vi.fn(),
      acceptAsExisting: vi.fn(() => of(undefined)),
    };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>, {
      session: makeSession('MORADOR@exemplo.com'),
    });
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Confirme a declaração');
    expect(html).toContain('Aceitar convite');

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const cmp = fixture.componentInstance as unknown as {
      linkForm: { patchValue: (v: Record<string, unknown>) => void };
      submitLink: () => void;
    };
    cmp.linkForm.patchValue({ acceptanceConfirmed: true });
    cmp.submitLink();

    expect(api.acceptAsExisting).toHaveBeenCalledTimes(1);
    expect(api.acceptAsExisting).toHaveBeenCalledWith(
      'tok-abc',
      expect.objectContaining({ acceptanceConfirmed: true }),
    );
    expect(navSpy).toHaveBeenCalledWith(['/app']);
  });

  it('WRONG_USER: emailHasAccount=true e sessão com e-mail diferente', async () => {
    const resp: ValidateInvitationResponse = { ...validResponse, emailHasAccount: true };
    const api = { validate: vi.fn(() => of(resp)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>, {
      session: makeSession('outro@exemplo.com'),
    });
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Você está logado como');
    expect(html).toContain('Sair');
  });

  it('renderiza tela de expirado quando state=EXPIRED', async () => {
    const expiredResp: ValidateInvitationResponse = {
      state: 'EXPIRED',
      email: null,
      apartmentLabel: null,
      condominiumName: null,
      role: null,
      expiresAt: null,
      emailHasAccount: false,
    };
    const api = { validate: vi.fn(() => of(expiredResp)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);
    expect(fixture.nativeElement.outerHTML).toContain('Convite expirado');
  });
});
