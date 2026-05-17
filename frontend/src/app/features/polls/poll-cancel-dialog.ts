import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-poll-cancel-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <!-- Overlay -->
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
      >
        <div class="bg-surface rounded-2xl border border-outline-variant shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
          <div>
            <h2 id="cancel-dialog-title" class="text-lg font-semibold text-on-surface">
              Cancelar votação
            </h2>
            <p class="text-sm text-on-surface-variant mt-1">
              Cancelar é irreversível. Votos já registrados serão preservados (não há contagem).
            </p>
          </div>

          <div class="flex flex-col gap-1">
            <label for="cancel-reason" class="text-sm font-medium text-on-surface">
              Motivo <span class="text-error">*</span>
            </label>
            <textarea
              id="cancel-reason"
              [formControl]="reasonControl"
              rows="4"
              maxlength="500"
              placeholder="Descreva o motivo do cancelamento..."
              class="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            ></textarea>
            <div class="flex items-start justify-between gap-2 mt-0.5">
              @if (reasonControl.invalid && reasonControl.touched) {
                <p class="text-xs text-error" role="alert">
                  Motivo obrigatório (mínimo 10 caracteres)
                </p>
              } @else {
                <span></span>
              }
              <span class="text-xs text-on-surface-variant shrink-0">
                {{ reasonControl.value?.length ?? 0 }}/500
              </span>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant text-on-surface hover:bg-surface-container"
              (click)="onClose()"
            >
              Voltar
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm font-medium bg-error text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              [disabled]="reasonControl.invalid"
              (click)="onConfirm()"
            >
              Confirmar cancelamento
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PollCancelDialog implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Output() readonly confirm = new EventEmitter<string>();
  @Output() readonly close = new EventEmitter<void>();

  protected readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(10), Validators.maxLength(500)],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.reasonControl.reset('');
      this.reasonControl.markAsUntouched();
      this.cdr.markForCheck();
    }
  }

  onConfirm(): void {
    this.reasonControl.markAsTouched();
    if (this.reasonControl.invalid) return;
    this.confirm.emit(this.reasonControl.value);
  }

  onClose(): void {
    this.close.emit();
  }
}
