import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Apartment } from '../../core/api/apartments-api.service';
import { CreateInvitationRequest, InvitationRole } from '../../core/api/invitations-api.service';
import { FormField } from '../../shared/ui/form-field';

function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function sortedApartments(apartments: readonly Apartment[]): readonly Apartment[] {
  return [...apartments].sort((a, b) => {
    const blockCmp = (a.block ?? '').localeCompare(b.block ?? '');
    return blockCmp !== 0 ? blockCmp : a.unitNumber.localeCompare(b.unitNumber);
  });
}

@Component({
  selector: 'app-invitation-individual-form',
  imports: [ReactiveFormsModule, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="onSubmit()" [formGroup]="form" class="flex flex-col gap-4">

      <app-form-field
        #aptField
        label="Apartamento"
        [control]="apartmentId"
        [errors]="{ required: 'Obrigatório' }"
      >
        <select
          [id]="aptField.fieldId"
          formControlName="apartmentId"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        >
          <option value="" disabled>Selecione…</option>
          @for (apt of sortedApts(); track apt.id) {
            <option [value]="apt.id">
              {{ apt.block ? 'Bloco ' + apt.block + ' · ' + apt.unitNumber : apt.unitNumber }}
            </option>
          }
        </select>
      </app-form-field>

      <fieldset class="flex flex-col gap-1">
        <legend class="text-sm font-medium text-on-surface mb-1">Papel</legend>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" formControlName="role" value="OWNER" class="accent-secondary" />
          <span class="text-sm text-on-surface">Proprietário</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" formControlName="role" value="TENANT" class="accent-secondary" />
          <span class="text-sm text-on-surface">Inquilino</span>
        </label>
      </fieldset>

      <app-form-field
        #emailField
        label="E-mail"
        [control]="email"
        [errors]="{ required: 'Obrigatório', email: 'E-mail inválido' }"
      >
        <input
          [id]="emailField.fieldId"
          type="email"
          formControlName="email"
          autocomplete="email"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        />
      </app-form-field>

      <app-form-field
        #cpfField
        label="CPF"
        [control]="cpf"
        [errors]="{ required: 'Obrigatório', pattern: 'CPF inválido (11 dígitos)' }"
      >
        <input
          [id]="cpfField.fieldId"
          type="text"
          formControlName="cpf"
          placeholder="000.000.000-00"
          maxlength="14"
          (input)="onCpfInput($event)"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        />
      </app-form-field>

      @if (errorMessage()) {
        <p class="text-sm text-error" role="alert">{{ errorMessage() }}</p>
      }

      <div class="flex justify-end gap-3">
        <button
          type="button"
          (click)="cancel.emit()"
          class="px-4 py-2 text-sm rounded-lg border border-outline-variant hover:bg-surface-container"
        >
          Cancelar
        </button>
        <button
          type="submit"
          [disabled]="form.invalid || loading()"
          class="px-4 py-2 text-sm rounded-lg bg-secondary text-white disabled:opacity-50"
        >
          Enviar convite
        </button>
      </div>
    </form>
  `,
})
export class InvitationIndividualForm implements OnInit {
  readonly apartments = input<readonly Apartment[]>([]);

  readonly submit = output<CreateInvitationRequest>();
  readonly cancel = output<void>();

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loading = signal(false);

  readonly apartmentId = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly role = new FormControl<InvitationRole>('OWNER', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  readonly cpf = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)],
  });

  readonly form = new FormGroup({
    apartmentId: this.apartmentId,
    role: this.role,
    email: this.email,
    cpf: this.cpf,
  });

  ngOnInit(): void {
    this.errorMessage.set(null);
  }

  setError(message: string): void {
    this.errorMessage.set(message);
    this.loading.set(false);
  }

  protected get sortedApts(): () => readonly Apartment[] {
    return () => sortedApartments(this.apartments());
  }

  protected onCpfInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatCpf(input.value);
    this.cpf.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const { apartmentId, email, cpf, role } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);
    this.submit.emit({ apartmentId, email, cpf, role });
  }
}
