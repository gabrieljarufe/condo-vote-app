import { Component, Input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  CompleteRegistrationResponse,
  OnboardingApiService,
  ValidateInvitationResponse,
} from '../../core/api/onboarding-api.service';
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

const validResponse: ValidateInvitationResponse = {
  state: 'VALID',
  email: 'morador@exemplo.com',
  apartmentLabel: 'Bloco A · Apto 101',
  condominiumName: 'Edifício Teste',
  role: 'OWNER',
  expiresAt: '2026-12-01T00:00:00Z',
};

async function setup(
  apiOverrides: Partial<OnboardingApiService>,
  token: string | null = 'tok-abc',
) {
  await TestBed.configureTestingModule({
    imports: [InvitationAcceptPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: OnboardingApiService, useValue: apiOverrides },
      { provide: ActivatedRoute, useValue: activatedRouteWith(token) },
    ],
  })
    .overrideComponent(InvitationAcceptPage, {
      set: { imports: [FormFieldStub, Spinner, ReactiveFormsModule] },
    })
    .compileComponents();
  const fixture = TestBed.createComponent(InvitationAcceptPage);
  fixture.detectChanges();
  return { fixture };
}

describe('InvitationAcceptPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza form quando token é VALID e popula nome do condomínio', async () => {
    const api = { validate: vi.fn(() => of(validResponse)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);
    expect(api.validate).toHaveBeenCalledWith('tok-abc');
    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('Edifício Teste');
    expect(html).toContain('Bloco A · Apto 101');
    expect(html).toContain('Aceitar convite');
  });

  it('submete e redireciona para /login?registered=1 no happy-path', async () => {
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
        patchValue: (v: Record<string, string>) => void;
      };
      submit: () => void;
    };
    cmp.form.patchValue({
      fullName: 'Morador Teste',
      cpf: '111.444.777-35',
      password: 'senha-forte-1',
      confirmPassword: 'senha-forte-1',
    });
    cmp.submit();

    expect(api.complete).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledWith(['/login'], { queryParams: { registered: '1' } });
  });

  it('mostra mensagem de erro quando backend devolve 400 (CPF)', async () => {
    const api = {
      validate: vi.fn(() => of(validResponse)),
      complete: vi.fn(() =>
        throwError(() => ({ status: 400, error: { message: 'CPF não confere com o convite' } })),
      ),
    };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);

    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue: (v: Record<string, string>) => void };
      submit: () => void;
    };
    cmp.form.patchValue({
      fullName: 'Morador Teste',
      cpf: '999.999.999-99',
      password: 'senha-forte-1',
      confirmPassword: 'senha-forte-1',
    });
    cmp.submit();
    fixture.detectChanges();

    const html = fixture.nativeElement.outerHTML as string;
    expect(html).toContain('CPF não confere');
  });

  it('renderiza tela de expirado quando state=EXPIRED', async () => {
    const expiredResp: ValidateInvitationResponse = {
      state: 'EXPIRED',
      email: null,
      apartmentLabel: null,
      condominiumName: null,
      role: null,
      expiresAt: null,
    };
    const api = { validate: vi.fn(() => of(expiredResp)), complete: vi.fn() };
    const { fixture } = await setup(api as unknown as Partial<OnboardingApiService>);
    expect(fixture.nativeElement.outerHTML).toContain('Convite expirado');
  });
});
