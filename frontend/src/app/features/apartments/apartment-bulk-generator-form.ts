import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FormField } from '../../shared/ui/form-field';
import {
  GeneratedApartment,
  GeneratorConfig,
  generateApartments,
} from './generate-apartments';

const PRESETS = [
  { value: '{andar}{seq:02}', label: 'Padrão (101, 102, 201…)' },
  { value: '{andar}-{seq}', label: 'Com traço (1-1, 1-2…)' },
  { value: '{seq:03}', label: 'Sequencial (001, 002…)' },
  { value: 'custom', label: 'Personalizado' },
] as const;

function bulkGroupValidator(control: AbstractControl): ValidationErrors | null {
  const group = control as FormGroup;
  const floorStart = group.get('floorStart')?.value as number | null;
  const floorEnd = group.get('floorEnd')?.value as number | null;
  const pattern = group.get('pattern')?.value as string;
  const customPattern = group.get('customPattern')?.value as string;
  const unitsPerFloor = group.get('unitsPerFloor')?.value as number | null;
  const skipFloorsRaw = group.get('skipFloorsRaw')?.value as string;
  const block = group.get('block')?.value as string;

  if (floorStart == null || floorEnd == null || unitsPerFloor == null) {
    return null;
  }

  const errors: ValidationErrors = {};

  if (floorEnd < floorStart) {
    errors['floorRangeInvalid'] = true;
  }

  const effectivePattern = pattern === 'custom' ? customPattern : pattern;
  if (effectivePattern && !errors['floorRangeInvalid']) {
    const config: GeneratorConfig = {
      block: block ?? '',
      floorStart,
      floorEnd,
      unitsPerFloor,
      pattern: effectivePattern,
      skipFloors: parseSkipFloors(skipFloorsRaw),
    };
    const result = generateApartments(config);
    if (result.length > 500) {
      errors['tooManyApartments'] = true;
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function parseSkipFloors(raw: string | undefined | null): number[] {
  return (
    raw
      ?.split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n)) ?? []
  );
}

function buildPreview(
  valid: boolean,
  value: {
    block: string;
    floorStart: number;
    floorEnd: number;
    unitsPerFloor: number;
    pattern: string;
    customPattern: string;
    skipFloorsRaw: string;
  },
): string | null {
  if (!valid) return null;

  const effectivePattern = value.pattern === 'custom' ? value.customPattern : value.pattern;
  if (!effectivePattern) return null;

  const config: GeneratorConfig = {
    block: value.block,
    floorStart: value.floorStart,
    floorEnd: value.floorEnd,
    unitsPerFloor: value.unitsPerFloor,
    pattern: effectivePattern,
    skipFloors: parseSkipFloors(value.skipFloorsRaw),
  };

  const apartments = generateApartments(config);
  if (apartments.length === 0) return null;

  const first = apartments[0].unitNumber;
  const second = apartments[1]?.unitNumber;
  const last = apartments[apartments.length - 1].unitNumber;
  const sample = second ? `${first}, ${second} … ${last}` : first;

  return `Exemplo: ${sample} — ${apartments.length} apartamentos`;
}

const patternRequiredWhenCustom: ValidatorFn = (control: AbstractControl) => {
  const group = control.parent as FormGroup | null;
  if (!group) return null;
  const pattern = group.get('pattern')?.value as string;
  if (pattern === 'custom' && !control.value) {
    return { required: true };
  }
  return null;
};

@Component({
  selector: 'app-apartment-bulk-generator-form',
  imports: [ReactiveFormsModule, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="flex flex-col gap-6">

      <!-- Bloco -->
      <app-form-field label="Bloco / Torre (opcional)" [control]="form.controls.block" #blockField>
        <input
          [id]="blockField.fieldId"
          type="text"
          formControlName="block"
          maxlength="50"
          placeholder="Ex: A, Torre 1"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        />
      </app-form-field>

      <!-- Andares (2 colunas) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <app-form-field
          label="Andar inicial"
          [control]="form.controls.floorStart"
          [errors]="floorStartErrors"
          #floorStartField
        >
          <input
            [id]="floorStartField.fieldId"
            type="number"
            formControlName="floorStart"
            min="1"
            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
          />
        </app-form-field>

        <app-form-field
          label="Andar final"
          [control]="form.controls.floorEnd"
          [errors]="floorEndErrors"
          #floorEndField
        >
          <input
            [id]="floorEndField.fieldId"
            type="number"
            formControlName="floorEnd"
            min="1"
            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
          />
        </app-form-field>
      </div>

      <!-- Aptos por andar -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <app-form-field
          label="Aptos por andar"
          [control]="form.controls.unitsPerFloor"
          [errors]="unitsPerFloorErrors"
          #unitsField
        >
          <input
            [id]="unitsField.fieldId"
            type="number"
            formControlName="unitsPerFloor"
            min="1"
            max="50"
            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
          />
        </app-form-field>
      </div>

      <!-- Padrão de numeração -->
      <app-form-field
        label="Padrão de numeração"
        [control]="form.controls.pattern"
        [errors]="patternErrors"
        #patternField
      >
        <select
          [id]="patternField.fieldId"
          formControlName="pattern"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        >
          @for (preset of presets; track preset.value) {
            <option [value]="preset.value">{{ preset.label }}</option>
          }
        </select>
      </app-form-field>

      @if (isCustomPattern()) {
        <app-form-field
          label="Padrão customizado"
          [control]="form.controls.customPattern"
          [errors]="customPatternErrors"
          #customPatternField
        >
          <input
            [id]="customPatternField.fieldId"
            type="text"
            formControlName="customPattern"
            placeholder="Ex: {andar}{seq:02}"
            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
          />
        </app-form-field>
      }

      <!-- Andares a pular -->
      <app-form-field
        label="Andares a pular (separados por vírgula)"
        [control]="form.controls.skipFloorsRaw"
        #skipField
      >
        <input
          [id]="skipField.fieldId"
          type="text"
          formControlName="skipFloorsRaw"
          placeholder="Ex: 13, 4"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        />
      </app-form-field>

      <!-- Erros do grupo -->
      @if (form.errors?.['floorRangeInvalid'] && (form.controls.floorEnd.dirty || form.controls.floorEnd.touched)) {
        <p class="text-xs text-error" role="alert">
          Andar final deve ser maior ou igual ao andar inicial.
        </p>
      }

      @if (form.errors?.['tooManyApartments']) {
        <p class="text-xs text-error" role="alert">
          A configuração geraria mais de 500 apartamentos. Reduza o intervalo de andares ou os aptos por andar.
        </p>
      }

      <!-- Preview -->
      @if (preview()) {
        <div class="rounded-xl bg-surface-container border border-outline-variant px-4 py-3 text-sm text-on-surface-variant">
          {{ preview() }}
        </div>
      }

      <!-- Botão -->
      <div class="flex justify-end">
        <button
          type="submit"
          [disabled]="form.invalid"
          class="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Gerar preview
        </button>
      </div>

    </form>
  `,
})
export class ApartmentBulkGeneratorForm implements OnInit {
  readonly generate = output<GeneratedApartment[]>();

  protected readonly presets = PRESETS;

  protected readonly form = new FormGroup(
    {
      block: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(50)],
      }),
      floorStart: new FormControl(1, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1)],
      }),
      floorEnd: new FormControl(12, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1)],
      }),
      unitsPerFloor: new FormControl(4, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(50)],
      }),
      pattern: new FormControl('{andar}{seq:02}', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      customPattern: new FormControl('', {
        nonNullable: true,
        validators: [patternRequiredWhenCustom],
      }),
      skipFloorsRaw: new FormControl('', { nonNullable: true }),
    },
    { validators: bulkGroupValidator },
  );

  protected readonly isCustomPattern = signal(false);
  readonly preview = signal<string | null>(null);

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => this.updatePreview());
    this.updatePreview();
  }

  private updatePreview(): void {
    const v = this.form.getRawValue();
    this.preview.set(buildPreview(this.form.valid, v));
  }

  protected skipFloors(): number[] {
    return parseSkipFloors(this.form.value.skipFloorsRaw);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const effectivePattern = v.pattern === 'custom' ? v.customPattern : v.pattern;

    const config: GeneratorConfig = {
      block: v.block,
      floorStart: v.floorStart,
      floorEnd: v.floorEnd,
      unitsPerFloor: v.unitsPerFloor,
      pattern: effectivePattern,
      skipFloors: parseSkipFloors(v.skipFloorsRaw),
    };

    this.generate.emit(generateApartments(config));
  }

  protected readonly floorStartErrors = {
    required: 'Andar inicial é obrigatório',
    min: 'Deve ser ao menos 1',
  };

  protected readonly floorEndErrors = {
    required: 'Andar final é obrigatório',
    min: 'Deve ser ao menos 1',
  };

  protected readonly unitsPerFloorErrors = {
    required: 'Campo obrigatório',
    min: 'Deve ser ao menos 1',
    max: 'Máximo de 50 aptos por andar',
  };

  protected readonly patternErrors = {
    required: 'Padrão é obrigatório',
  };

  protected readonly customPatternErrors = {
    required: 'Informe o padrão customizado',
  };
}
