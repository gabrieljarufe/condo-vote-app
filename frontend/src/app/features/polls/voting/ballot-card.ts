import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { PollOptionResponse } from '../../../core/api/polls-api.service';

@Component({
  selector: 'app-ballot-card',
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-surface-container-low rounded-2xl border p-4 sm:p-6"
      [class.border-outline-variant]="!disabled"
      [class.border-primary]="disabled"
      [attr.aria-disabled]="disabled ? 'true' : null"
    >
      <div class="flex items-start justify-between mb-4">
        <div>
          <p class="text-xs font-medium text-on-surface-variant uppercase tracking-wide">Apartamento</p>
          <p class="text-lg font-semibold text-on-surface mt-0.5">{{ apartmentLabel }}</p>
        </div>
        @if (disabled && selectedOptionId) {
          <span class="rounded-full bg-primary-container text-on-primary-container text-xs font-medium px-3 py-1">
            ✓ Confirmado
          </span>
        }
      </div>

      <fieldset [disabled]="disabled" class="space-y-2">
        <legend class="text-xs text-on-surface-variant mb-2">Selecione uma opção</legend>
        @for (opt of options; track opt.id) {
          <label
            class="flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors min-h-11"
            [ngClass]="opt.id === selectedOptionId
              ? 'bg-primary/10 border-primary'
              : 'border-outline-variant ' + (!disabled ? 'hover:bg-surface-container' : '')"
            [class.cursor-not-allowed]="disabled"
          >
            <input
              type="radio"
              class="accent-primary mt-0.5 shrink-0"
              [name]="radioGroupName"
              [value]="opt.id"
              [checked]="opt.id === selectedOptionId"
              [disabled]="disabled"
              (change)="onSelect(opt.id)"
            />
            <span class="text-sm text-on-surface">{{ opt.label }}</span>
          </label>
        }
      </fieldset>
    </div>
  `,
})
export class BallotCard {
  @Input({ required: true }) apartmentLabel!: string;
  @Input({ required: true }) options: ReadonlyArray<PollOptionResponse> = [];
  @Input() selectedOptionId: string | null = null;
  @Input() disabled = false;
  /** Deve ser único por página quando múltiplas cédulas são exibidas (BallotReviewPage). */
  @Input() radioGroupName = 'ballot-options';

  @Output() readonly optionChange = new EventEmitter<string>();

  protected onSelect(optionId: string): void {
    if (!this.disabled) {
      this.optionChange.emit(optionId);
    }
  }
}
