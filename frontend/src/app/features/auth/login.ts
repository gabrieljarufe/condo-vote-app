import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FormField } from '../../shared/ui/form-field';
import { Spinner } from '../../shared/ui/spinner';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FormField, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen grid place-items-center bg-surface p-6">
      <div class="w-full max-w-md">
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 shadow-sm">
          <a routerLink="/" class="block text-xl font-bold text-on-surface mb-1">Condo Vote</a>
          <h1 class="text-2xl font-semibold text-on-surface mb-1">Entrar</h1>
          <p class="text-sm text-on-surface-variant mb-8">
            Acesse com seu e-mail e senha cadastrados.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-5" novalidate>
            <app-form-field
              label="E-mail"
              [control]="form.controls.email"
              [errors]="emailErrors"
              #emailField
            >
              <input
                [id]="emailField.fieldId"
                type="email"
                autocomplete="email"
                formControlName="email"
                class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
              />
            </app-form-field>

            <app-form-field
              label="Senha"
              [control]="form.controls.password"
              [errors]="passwordErrors"
              #passwordField
            >
              <input
                [id]="passwordField.fieldId"
                type="password"
                autocomplete="current-password"
                formControlName="password"
                class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
                [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched"
              />
            </app-form-field>

            @if (errorMessage()) {
              <p class="text-sm text-error" role="alert" aria-live="polite">
                {{ errorMessage() }}
              </p>
            }

            <button
              type="submit"
              [disabled]="loading() || form.invalid"
              class="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-secondary text-on-secondary font-medium disabled:opacity-50 hover:brightness-110 transition-all"
            >
              @if (loading()) {
                <app-spinner label="Entrando…" />
              } @else {
                Entrar
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export default class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly emailErrors = {
    required: 'E-mail é obrigatório',
    email: 'E-mail inválido',
  };

  protected readonly passwordErrors = {
    required: 'Senha é obrigatória',
    minlength: 'Senha deve ter ao menos 6 caracteres',
  };

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app';
      await this.router.navigateByUrl(returnUrl);
    } catch (e) {
      this.errorMessage.set(this.formatError(e));
    } finally {
      this.loading.set(false);
    }
  }

  private formatError(e: unknown): string {
    if (e instanceof Error) {
      const msg = e.message.toLowerCase();
      if (msg.includes('invalid login credentials')) {
        return 'E-mail ou senha incorretos.';
      }
      if (msg.includes('email not confirmed')) {
        return 'Confirme seu e-mail antes de entrar.';
      }
    }
    return 'Não foi possível entrar. Tente novamente.';
  }
}
