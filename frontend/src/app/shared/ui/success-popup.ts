import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { Dialog } from './dialog';

@Component({
  selector: 'app-success-popup',
  standalone: true,
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [open]="open" [closeOnEsc]="false" [closeOnBackdrop]="false">
      <div class="flex flex-col items-center text-center py-4 success-pop">
        <svg class="success-check" viewBox="0 0 52 52" width="80" height="80" aria-hidden="true">
          <circle class="check-circle" cx="26" cy="26" r="24" fill="none" stroke-width="3" />
          <path
            class="check-mark"
            fill="none"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14 27 l8 8 l16-16"
          />
        </svg>
        <p
          role="status"
          aria-live="polite"
          class="mt-4 text-base font-medium text-on-surface success-text"
        >
          {{ message }}
        </p>
      </div>
    </app-dialog>
  `,
  styles: `
    .success-pop { animation: pop-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    @keyframes pop-in {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); }
    }
    .check-circle {
      stroke: var(--color-success);
      stroke-dasharray: 166;
      stroke-dashoffset: 166;
      animation: stroke-draw 600ms 100ms ease-out forwards;
    }
    .check-mark {
      stroke: var(--color-success);
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: stroke-draw 300ms 700ms ease-out forwards;
    }
    @keyframes stroke-draw {
      to { stroke-dashoffset: 0; }
    }
    .success-text {
      opacity: 0;
      animation: fade-in 300ms 1000ms ease-out forwards;
    }
    @keyframes fade-in {
      to { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .success-pop,
      .check-circle,
      .check-mark,
      .success-text {
        animation: none;
      }
      .check-circle,
      .check-mark { stroke-dashoffset: 0; }
      .success-text { opacity: 1; }
    }
  `,
})
export class SuccessPopup implements OnChanges {
  @Input() open = false;
  @Input() voteCount = 1;
  @Input() durationMs = 2500;
  @Output() readonly closed = new EventEmitter<void>();

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.clearTimer());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      this.clearTimer();
      this.timeoutId = setTimeout(() => this.closed.emit(), this.durationMs);
    } else {
      this.clearTimer();
    }
  }

  protected get message(): string {
    return this.voteCount === 1
      ? 'Voto computado com sucesso!'
      : `${this.voteCount} votos computados com sucesso!`;
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
