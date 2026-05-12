import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateApartmentRequest } from '../../core/api/apartments-api.service';
import { FormField } from '../../shared/ui/form-field';

@Component({
  selector: 'app-apartment-form',
  imports: [ReactiveFormsModule, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="submit()" [formGroup]="form" class="flex flex-col gap-4">
      <app-form-field
        label="Número da unidade"
        [control]="unitNumber"
        [errors]="{ required: 'Obrigatório', maxlength: 'Máximo 20 caracteres' }"
      />
      <app-form-field
        label="Bloco"
        [control]="block"
        [errors]="{ maxlength: 'Máximo 50 caracteres' }"
      />

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
          [disabled]="form.invalid"
          class="px-4 py-2 text-sm rounded-lg bg-secondary text-white disabled:opacity-50"
        >
          Cadastrar
        </button>
      </div>
    </form>
  `,
})
export class ApartmentForm implements OnInit {
  readonly submit$ = output<CreateApartmentRequest>({ alias: 'submit' });
  readonly cancel = output<void>();

  protected readonly errorMessage = signal<string | null>(null);

  readonly unitNumber = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(20)],
  });

  readonly block = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(50)],
  });

  readonly form = new FormGroup({ unitNumber: this.unitNumber, block: this.block });

  ngOnInit(): void {
    this.errorMessage.set(null);
  }

  setError(message: string): void {
    this.errorMessage.set(message);
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const { unitNumber, block } = this.form.getRawValue();
    this.submit$.emit({ unitNumber, block: block || undefined });
  }
}
