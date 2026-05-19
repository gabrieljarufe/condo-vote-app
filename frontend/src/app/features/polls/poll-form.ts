import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CreatePollRequest } from '../../core/api/polls-api.service';
import { Dropdown } from '../../shared/ui/dropdown';
import { FormField } from '../../shared/ui/form-field';

type Convocation = 'FIRST' | 'SECOND';
type QuorumMode = 'SIMPLE_MAJORITY' | 'ABSOLUTE_MAJORITY' | 'QUALIFIED_2_3' | 'QUALIFIED_3_4';

export interface PollFormValue {
  title: string;
  description: string;
  convocation: string;
  quorumMode: string;
  scheduledStart: string;
  scheduledEnd: string;
  options: string[];
}

const CONVOCATION_OPTIONS = [
  { value: 'FIRST', label: 'Primeira Convocação' },
  { value: 'SECOND', label: 'Segunda Convocação' },
] as const;

const QUORUM_OPTIONS = [
  { value: 'SIMPLE_MAJORITY', label: 'Maioria simples' },
  { value: 'ABSOLUTE_MAJORITY', label: 'Maioria absoluta' },
  { value: 'QUALIFIED_2_3', label: '2/3 qualificada' },
  { value: 'QUALIFIED_3_4', label: '3/4 qualificada' },
] as const;

/**
 * Formata data/hora local para o formato exigido por <input type="datetime-local">.
 * Aceita offset em minutos a partir de agora.
 */
function defaultDateTimeLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) +
    ':' + pad(d.getMinutes())
  );
}

function endAfterStartValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = (group.get('scheduledStart') as FormControl)?.value as string;
    const end = (group.get('scheduledEnd') as FormControl)?.value as string;
    if (!start || !end) return null;
    return new Date(end) > new Date(start) ? null : { endBeforeStart: true };
  };
}

function optionsValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const arr = control as FormArray;
    const values: string[] = arr.controls.map((c) => (c as FormControl).value as string);
    if (arr.length < 2) return { minOptions: true };
    if (arr.length > 10) return { maxOptions: true };
    const blanks = values.some((v) => !v || v.trim() === '');
    if (blanks) return { blankOption: true };
    const normalized = values.map((v) => v.trim().toLowerCase());
    const hasDups = normalized.some((v, i) => normalized.indexOf(v) !== i);
    if (hasDups) return { duplicateOptions: true };
    return null;
  };
}

@Component({
  selector: 'app-poll-form',
  imports: [ReactiveFormsModule, FormField, Dropdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="submit()" [formGroup]="form" class="flex flex-col gap-5">

      <!-- Título -->
      <app-form-field
        #titleField
        label="Título"
        [control]="title"
        [errors]="{ required: 'Obrigatório', maxlength: 'Máximo 200 caracteres' }"
      >
        <input
          [id]="titleField.fieldId"
          type="text"
          formControlName="title"
          maxlength="200"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
        />
      </app-form-field>

      <!-- Descrição -->
      <app-form-field
        #descField
        label="Descrição (opcional)"
        [control]="description"
        [errors]="{ maxlength: 'Máximo 2000 caracteres' }"
      >
        <textarea
          [id]="descField.fieldId"
          formControlName="description"
          maxlength="2000"
          rows="3"
          class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary resize-y"
        ></textarea>
      </app-form-field>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <!-- Convocação -->
        <app-form-field
          #convoField
          label="Convocação"
          [control]="convocation"
          [errors]="{ required: 'Obrigatório' }"
        >
          <app-dropdown [options]="convocationOptions" formControlName="convocation" />
        </app-form-field>

        <!-- Quórum -->
        <app-form-field
          #quorumField
          label="Modo de quórum"
          [control]="quorumMode"
          [errors]="{ required: 'Obrigatório' }"
        >
          <app-dropdown [options]="quorumOptions" formControlName="quorumMode" />
        </app-form-field>
      </div>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <!-- Início -->
        <app-form-field
          #startField
          label="Início previsto"
          [control]="scheduledStart"
          [errors]="{ required: 'Obrigatório' }"
        >
          <input
            [id]="startField.fieldId"
            type="datetime-local"
            formControlName="scheduledStart"
            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
          />
        </app-form-field>

        <!-- Fim -->
        <app-form-field
          #endField
          label="Fim previsto"
          [control]="scheduledEnd"
          [errors]="{ required: 'Obrigatório' }"
        >
          <input
            [id]="endField.fieldId"
            type="datetime-local"
            formControlName="scheduledEnd"
            class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
          />
        </app-form-field>
      </div>

      @if (form.hasError('endBeforeStart') && (scheduledEnd.dirty || scheduledEnd.touched)) {
        <p class="text-xs text-error" role="alert">A data de fim deve ser posterior ao início.</p>
      }

      <!-- Opções de votação -->
      <div class="flex flex-col gap-3">
        <p class="text-sm font-medium text-on-surface">Opções de votação</p>

        <div formArrayName="options" class="flex flex-col gap-2">
          @for (ctrl of optionControls; track $index; let i = $index) {
            <div class="flex items-center gap-2">
              <input
                type="text"
                [formControlName]="i"
                [placeholder]="'Opção ' + (i + 1)"
                maxlength="200"
                class="flex-1 px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-secondary"
              />
              <button
                type="button"
                (click)="removeOption(i)"
                [disabled]="options.length <= 2"
                class="px-3 py-2.5 text-sm rounded-lg border border-outline-variant text-error hover:bg-error/10 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Remover opção"
              >
                Remover
              </button>
            </div>
          }
        </div>

        @if (options.errors) {
          @if (options.errors['blankOption'] && options.dirty) {
            <p class="text-xs text-error" role="alert">Todas as opções devem ser preenchidas.</p>
          } @else if (options.errors['duplicateOptions'] && options.dirty) {
            <p class="text-xs text-error" role="alert">Opções duplicadas não são permitidas.</p>
          } @else if (options.errors['minOptions']) {
            <p class="text-xs text-error" role="alert">É necessário pelo menos 2 opções.</p>
          }
        }

        <button
          type="button"
          (click)="addOption()"
          [disabled]="options.length >= 10"
          class="self-start px-4 py-2 text-sm rounded-lg border border-outline-variant hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Adicionar opção
        </button>
      </div>

      @if (errorMessage()) {
        <p class="text-sm text-error" role="alert">{{ errorMessage() }}</p>
      }

      <div class="flex justify-end gap-3 pt-2">
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
          class="px-5 py-2 text-sm rounded-lg bg-secondary text-white disabled:opacity-50"
        >
          {{ submitLabel() }}
        </button>
      </div>
    </form>
  `,
})
export class PollForm implements OnInit {
  readonly initialValue = input<PollFormValue | null>(null);
  readonly submitLabel = input<string>('Criar rascunho');
  readonly submit$ = output<CreatePollRequest>({ alias: 'submit' });
  readonly cancel = output<void>();

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly convocationOptions = CONVOCATION_OPTIONS;
  protected readonly quorumOptions = QUORUM_OPTIONS;

  private readonly fb = inject(FormBuilder);

  readonly title = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)],
  });

  readonly description = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(2000)],
  });

  readonly convocation = new FormControl<Convocation>('FIRST', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly quorumMode = new FormControl<QuorumMode>('SIMPLE_MAJORITY', {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly scheduledStart = new FormControl(defaultDateTimeLocal(0), {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly scheduledEnd = new FormControl(defaultDateTimeLocal(30), {
    nonNullable: true,
    validators: [Validators.required],
  });

  readonly options: FormArray<FormControl<string>> = this.fb.array<FormControl<string>>(
    [this.makeOptionControl(), this.makeOptionControl()],
    [optionsValidator()],
  );

  readonly form = new FormGroup(
    {
      title: this.title,
      description: this.description,
      convocation: this.convocation,
      quorumMode: this.quorumMode,
      scheduledStart: this.scheduledStart,
      scheduledEnd: this.scheduledEnd,
      options: this.options,
    },
    { validators: [endAfterStartValidator()] },
  );

  protected get optionControls(): FormControl<string>[] {
    return this.options.controls;
  }

  constructor() {
    effect(() => {
      const val = this.initialValue();
      if (!val) return;
      this.title.setValue(val.title);
      this.description.setValue(val.description ?? '');
      this.convocation.setValue(val.convocation as Convocation);
      this.quorumMode.setValue(val.quorumMode as QuorumMode);
      this.scheduledStart.setValue(val.scheduledStart);
      this.scheduledEnd.setValue(val.scheduledEnd);

      // Rebuild options FormArray
      while (this.options.length > 0) {
        this.options.removeAt(0);
      }
      const opts = val.options.length >= 2 ? val.options : [...val.options, '', ''].slice(0, 2);
      for (const label of opts) {
        this.options.push(this.makeOptionControl(label));
      }
    });
  }

  ngOnInit(): void {
    this.errorMessage.set(null);
  }

  setError(message: string): void {
    this.errorMessage.set(message);
  }

  protected addOption(): void {
    if (this.options.length >= 10) return;
    this.options.push(this.makeOptionControl());
  }

  protected removeOption(index: number): void {
    if (this.options.length <= 2) return;
    this.options.removeAt(index);
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const request: CreatePollRequest = {
      title: raw.title,
      description: raw.description || undefined,
      convocation: raw.convocation as Convocation,
      quorumMode: raw.quorumMode as QuorumMode,
      scheduledStart: new Date(raw.scheduledStart).toISOString(),
      scheduledEnd: new Date(raw.scheduledEnd).toISOString(),
      options: raw.options.map((o) => o.trim()),
    };
    this.submit$.emit(request);
  }

  private makeOptionControl(value = ''): FormControl<string> {
    return this.fb.nonNullable.control(value);
  }
}
