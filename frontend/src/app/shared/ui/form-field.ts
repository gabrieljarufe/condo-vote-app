import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

let nextId = 0;

/**
 * Wrapper padronizado de campo de formulário.
 *
 * Encapsula label + input projetado + mensagem de erro acessível.
 * Toda feature com formulário usa este componente — garante UX consistente
 * e a11y mínima (label[for], aria-invalid, aria-describedby).
 *
 * Uso:
 *   <app-form-field
 *     label="E-mail"
 *     [control]="form.controls.email"
 *     [errors]="{ required: 'E-mail é obrigatório', email: 'E-mail inválido' }"
 *   >
 *     <input [id]="fieldId" type="email" formControlName="email" />
 *   </app-form-field>
 *
 * O componente expõe `fieldId` via template variable para o input usar:
 *   <app-form-field #f label="..."><input [id]="f.fieldId" ... /></app-form-field>
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5">
      <label [for]="fieldId" class="text-sm font-medium text-on-surface">
        {{ label() }}
      </label>

      <ng-content />

      @if (showError()) {
        <p
          [id]="errorId"
          class="text-xs text-error"
          role="alert"
          aria-live="polite"
        >
          {{ errorMessage() }}
        </p>
      }
    </div>
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly control = input.required<AbstractControl>();
  readonly errors = input<Record<string, string>>({});

  readonly fieldId = `ff-${nextId++}`;
  readonly errorId = `${this.fieldId}-error`;

  protected readonly showError = computed(() => {
    const c = this.control();
    return c.invalid && (c.dirty || c.touched);
  });

  protected readonly errorMessage = computed(() => {
    const c = this.control();
    if (!c.errors) return '';
    const errors = this.errors();
    for (const key of Object.keys(c.errors)) {
      if (errors[key]) return errors[key];
    }
    return 'Campo inválido';
  });
}
