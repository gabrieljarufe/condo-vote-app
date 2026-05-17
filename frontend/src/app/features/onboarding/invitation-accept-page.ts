import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CompleteRegistrationRequest,
  InvitationState,
  OnboardingApiService,
  ValidateInvitationResponse,
} from '../../core/api/onboarding-api.service';
import { FormField } from '../../shared/ui/form-field';
import { Spinner } from '../../shared/ui/spinner';

const passwordsMatch: ValidatorFn = (group) => {
  const pwd = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-invitation-accept-page',
  imports: [ReactiveFormsModule, RouterLink, FormField, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen grid place-items-center bg-surface p-6">
      <div class="w-full max-w-md">
        <div
          class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 shadow-sm"
        >
          <a routerLink="/" class="block text-xl font-bold text-on-surface mb-1">Condo Vote</a>

          @switch (uiState()) {
            @case ('LOADING') {
              <div class="py-10 flex flex-col items-center gap-3">
                <app-spinner label="Validando convite…" />
              </div>
            }
            @case ('VALID') {
              <h1 class="text-2xl font-semibold text-on-surface mb-1">Aceitar convite</h1>
              <p class="text-sm text-on-surface-variant mb-6">
                Você foi convidado para
                <strong>{{ invitation()?.condominiumName }}</strong>
                — {{ invitation()?.apartmentLabel }}
                ({{ invitation()?.role === 'OWNER' ? 'Proprietário' : 'Inquilino' }}).
              </p>

              <form
                [formGroup]="form"
                (ngSubmit)="submit()"
                class="flex flex-col gap-5"
                novalidate
              >
                <app-form-field label="E-mail" [control]="form.controls.email" #emailField>
                  <input
                    [id]="emailField.fieldId"
                    type="email"
                    formControlName="email"
                    readonly
                    class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed"
                  />
                </app-form-field>

                <app-form-field
                  label="Nome completo"
                  [control]="form.controls.fullName"
                  [errors]="{ required: 'Nome é obrigatório' }"
                  #nameField
                >
                  <input
                    [id]="nameField.fieldId"
                    type="text"
                    autocomplete="name"
                    formControlName="fullName"
                    class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                  />
                </app-form-field>

                <app-form-field
                  label="CPF"
                  [control]="form.controls.cpf"
                  [errors]="{ required: 'CPF é obrigatório', pattern: 'CPF inválido' }"
                  #cpfField
                >
                  <input
                    [id]="cpfField.fieldId"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="000.000.000-00"
                    formControlName="cpf"
                    (input)="onCpfInput($event)"
                    class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                  />
                </app-form-field>

                <app-form-field
                  label="Senha"
                  [control]="form.controls.password"
                  [errors]="{
                    required: 'Senha é obrigatória',
                    minlength: 'Senha deve ter ao menos 8 caracteres'
                  }"
                  #passwordField
                >
                  <input
                    [id]="passwordField.fieldId"
                    type="password"
                    autocomplete="new-password"
                    formControlName="password"
                    class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                  />
                </app-form-field>

                <app-form-field
                  label="Confirmar senha"
                  [control]="form.controls.confirmPassword"
                  [errors]="{ required: 'Confirme a senha' }"
                  #confirmField
                >
                  <input
                    [id]="confirmField.fieldId"
                    type="password"
                    autocomplete="new-password"
                    formControlName="confirmPassword"
                    class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                  />
                </app-form-field>

                @if (form.hasError('passwordMismatch') && form.touched) {
                  <p class="text-xs text-error" role="alert" aria-live="polite">
                    As senhas não conferem.
                  </p>
                }

                @if (errorMessage()) {
                  <p class="text-sm text-error" role="alert" aria-live="polite">
                    {{ errorMessage() }}
                  </p>
                }

                <button
                  type="submit"
                  [disabled]="submitting() || form.invalid"
                  class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium disabled:opacity-50 hover:brightness-110 transition-all"
                >
                  @if (submitting()) {
                    <app-spinner label="Criando conta…" />
                  } @else {
                    Criar conta
                  }
                </button>
              </form>
            }
            @case ('NOT_FOUND') {
              <h1 class="text-2xl font-semibold text-on-surface mb-2">Convite inválido</h1>
              <p class="text-sm text-on-surface-variant mb-6">
                Este link não corresponde a um convite ativo. Peça ao síndico para enviar um
                novo convite.
              </p>
              <a
                routerLink="/"
                class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium hover:brightness-110 transition-all"
                >Voltar para a home</a
              >
            }
            @case ('EXPIRED') {
              <h1 class="text-2xl font-semibold text-on-surface mb-2">Convite expirado</h1>
              <p class="text-sm text-on-surface-variant mb-6">
                Convites têm validade de 24h. Peça ao síndico para reenviar.
              </p>
              <a
                routerLink="/"
                class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium hover:brightness-110 transition-all"
                >Voltar para a home</a
              >
            }
            @case ('REVOKED') {
              <h1 class="text-2xl font-semibold text-on-surface mb-2">Convite revogado</h1>
              <p class="text-sm text-on-surface-variant mb-6">
                Este convite foi cancelado pelo síndico. Entre em contato para mais detalhes.
              </p>
              <a
                routerLink="/"
                class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium hover:brightness-110 transition-all"
                >Voltar para a home</a
              >
            }
            @case ('ALREADY_ACCEPTED') {
              <h1 class="text-2xl font-semibold text-on-surface mb-2">Convite já utilizado</h1>
              <p class="text-sm text-on-surface-variant mb-6">
                Este convite já foi aceito. Use o link
                <a routerLink="/login" class="text-secondary underline">entrar</a> com seu
                e-mail.
              </p>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export default class InvitationAcceptPage implements OnInit {
  private readonly api = inject(OnboardingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly uiState = signal<InvitationState | 'LOADING'>('LOADING');
  protected readonly invitation = signal<ValidateInvitationResponse | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup(
    {
      email: new FormControl<string>({ value: '', disabled: true }, { nonNullable: true }),
      fullName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(255)],
      }),
      cpf: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordsMatch] },
  );

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.uiState.set('NOT_FOUND');
      return;
    }
    this.api.validate(token).subscribe({
      next: (resp) => {
        this.invitation.set(resp);
        this.uiState.set(resp.state);
        if (resp.state === 'VALID' && resp.email) {
          this.form.patchValue({ email: resp.email });
        }
      },
      error: () => {
        this.uiState.set('NOT_FOUND');
      },
    });
  }

  protected onCpfInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);
    let masked = digits;
    if (digits.length > 9) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    this.form.controls.cpf.setValue(masked, { emitEvent: false });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const token = this.route.snapshot.paramMap.get('token')!;
    const raw = this.form.getRawValue();
    const req: CompleteRegistrationRequest = {
      token,
      cpf: raw.cpf,
      password: raw.password,
      fullName: raw.fullName.trim(),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.api.complete(req).subscribe({
      next: () => {
        this.router.navigate(['/login'], { queryParams: { registered: '1' } });
      },
      error: (err) => {
        this.submitting.set(false);
        const status = err?.status;
        const message = err?.error?.message ?? '';
        if (status === 400 && message.toLowerCase().includes('cpf')) {
          this.errorMessage.set('CPF não confere com o convite.');
        } else if (status === 409) {
          this.errorMessage.set(message || 'Convite não pôde ser aceito agora.');
        } else if (status === 429) {
          this.errorMessage.set('Muitas tentativas. Aguarde um minuto e tente novamente.');
        } else {
          this.errorMessage.set('Não foi possível criar sua conta. Tente novamente.');
        }
      },
    });
  }
}
