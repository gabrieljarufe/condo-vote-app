import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { AuthService } from '../../core/auth/auth.service';
import { FormField } from '../../shared/ui/form-field';
import { Spinner } from '../../shared/ui/spinner';

const passwordsMatch: ValidatorFn = (group) => {
  const pwd = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { passwordMismatch: true } : null;
};

type ValidMode = 'CREATE' | 'LOGIN_REQUIRED' | 'LINK' | 'WRONG_USER';

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

              @switch (mode()) {
                @case ('CREATE') {
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
                        (input)="onCpfInput($event, form.controls.cpf)"
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

                    <label
                      class="flex gap-3 text-sm text-on-surface items-start cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        formControlName="acceptanceConfirmed"
                        class="mt-1 w-4 h-4"
                      />
                      <span>
                        Declaro que sou
                        <strong>{{
                          invitation()?.role === 'OWNER' ? 'Proprietário' : 'Inquilino'
                        }}</strong>
                        do apartamento <strong>{{ invitation()?.apartmentLabel }}</strong> no
                        condomínio <strong>{{ invitation()?.condominiumName }}</strong>. Entendo
                        que este vínculo dá acesso a votações condominiais e fica registrado para
                        auditoria.
                      </span>
                    </label>

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
                @case ('LOGIN_REQUIRED') {
                  <p class="text-sm text-on-surface-variant mb-6">
                    Já existe uma conta para <strong>{{ invitation()?.email }}</strong>. Faça
                    login para aceitar este convite.
                  </p>
                  <button
                    type="button"
                    (click)="goToLogin()"
                    class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium hover:brightness-110 transition-all"
                  >
                    Entrar
                  </button>
                }
                @case ('LINK') {
                  <p class="text-sm text-on-surface-variant mb-6">
                    Confirme seu CPF para vincular este apartamento à sua conta.
                  </p>
                  <form
                    [formGroup]="linkForm"
                    (ngSubmit)="submitLink()"
                    class="flex flex-col gap-5"
                    novalidate
                  >
                    <div class="flex flex-col gap-1">
                      <span class="text-sm text-on-surface-variant">E-mail</span>
                      <input
                        type="email"
                        [value]="invitation()?.email ?? ''"
                        readonly
                        class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant cursor-not-allowed"
                      />
                    </div>

                    <app-form-field
                      label="CPF"
                      [control]="linkForm.controls.cpf"
                      [errors]="{ required: 'CPF é obrigatório', pattern: 'CPF inválido' }"
                      #linkCpfField
                    >
                      <input
                        [id]="linkCpfField.fieldId"
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        placeholder="000.000.000-00"
                        formControlName="cpf"
                        (input)="onCpfInput($event, linkForm.controls.cpf)"
                        class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                      />
                    </app-form-field>

                    <label
                      class="flex gap-3 text-sm text-on-surface items-start cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        formControlName="acceptanceConfirmed"
                        class="mt-1 w-4 h-4"
                      />
                      <span>
                        Declaro que sou
                        <strong>{{
                          invitation()?.role === 'OWNER' ? 'Proprietário' : 'Inquilino'
                        }}</strong>
                        do apartamento <strong>{{ invitation()?.apartmentLabel }}</strong> no
                        condomínio <strong>{{ invitation()?.condominiumName }}</strong>. Entendo
                        que este vínculo dá acesso a votações condominiais e fica registrado para
                        auditoria.
                      </span>
                    </label>

                    @if (errorMessage()) {
                      <p class="text-sm text-error" role="alert" aria-live="polite">
                        {{ errorMessage() }}
                      </p>
                    }

                    <button
                      type="submit"
                      [disabled]="submitting() || linkForm.invalid"
                      class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium disabled:opacity-50 hover:brightness-110 transition-all"
                    >
                      @if (submitting()) {
                        <app-spinner label="Vinculando…" />
                      } @else {
                        Aceitar convite
                      }
                    </button>
                  </form>
                }
                @case ('WRONG_USER') {
                  <p class="text-sm text-on-surface-variant mb-6">
                    Você está logado como
                    <strong>{{ auth.session()?.user?.email }}</strong
                    >, mas o convite é para <strong>{{ invitation()?.email }}</strong>. Saia da
                    conta e faça login com o e-mail correto.
                  </p>
                  <button
                    type="button"
                    (click)="signOutAndReload()"
                    class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium hover:brightness-110 transition-all"
                  >
                    Sair
                  </button>
                }
              }
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
  protected readonly auth = inject(AuthService);

  protected readonly uiState = signal<InvitationState | 'LOADING'>('LOADING');
  protected readonly invitation = signal<ValidateInvitationResponse | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly mode = computed<ValidMode | null>(() => {
    const inv = this.invitation();
    if (!inv || inv.state !== 'VALID') return null;
    if (!inv.emailHasAccount) return 'CREATE';
    const session = this.auth.session();
    if (!session) return 'LOGIN_REQUIRED';
    const sessEmail = session.user.email?.toLowerCase();
    const invEmail = inv.email?.toLowerCase();
    return sessEmail === invEmail ? 'LINK' : 'WRONG_USER';
  });

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
      acceptanceConfirmed: new FormControl<boolean>(false, {
        nonNullable: true,
        validators: [Validators.requiredTrue],
      }),
    },
    { validators: [passwordsMatch] },
  );

  protected readonly linkForm = new FormGroup({
    cpf: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)],
    }),
    acceptanceConfirmed: new FormControl<boolean>(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

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

  protected onCpfInput(ev: Event, control: FormControl<string>): void {
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
    control.setValue(masked, { emitEvent: false });
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
      acceptanceConfirmed: true,
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

  protected submitLink(): void {
    if (this.linkForm.invalid) {
      this.linkForm.markAllAsTouched();
      return;
    }
    const token = this.route.snapshot.paramMap.get('token')!;
    const raw = this.linkForm.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.api.acceptAsExisting(token, { cpf: raw.cpf, acceptanceConfirmed: true }).subscribe({
      next: () => {
        this.router.navigate(['/app']);
      },
      error: (err) => {
        this.submitting.set(false);
        const status = err?.status;
        if (status === 400) {
          this.errorMessage.set('CPF não confere com a sua conta.');
        } else if (status === 403) {
          this.errorMessage.set('Convite não pertence a esta conta.');
        } else if (status === 409) {
          this.errorMessage.set('Convite não está mais pendente.');
        } else if (status === 429) {
          this.errorMessage.set('Muitas tentativas. Aguarde um minuto e tente novamente.');
        } else {
          this.errorMessage.set('Não foi possível vincular o convite. Tente novamente.');
        }
      },
    });
  }

  protected goToLogin(): void {
    const token = this.route.snapshot.paramMap.get('token')!;
    this.router.navigate(['/login'], { queryParams: { redirect: `/invite/${token}` } });
  }

  protected async signOutAndReload(): Promise<void> {
    await this.auth.signOut();
    window.location.reload();
  }
}
