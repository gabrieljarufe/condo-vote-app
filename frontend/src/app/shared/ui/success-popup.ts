import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';

const EXIT_ANIMATION_MS = 280;

@Component({
  selector: 'app-success-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center popup-backdrop"
        [class.closing]="closing"
        data-popup-backdrop
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="success-popup-msg"
          class="bg-surface-container rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl popup-container"
          [class.closing]="closing"
        >
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
              id="success-popup-msg"
              role="status"
              aria-live="polite"
              class="mt-4 text-base font-medium text-on-surface success-text"
            >
              {{ message }}
            </p>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .popup-backdrop {
      animation: fade-in 160ms ease-out;
    }
    .popup-backdrop.closing {
      animation: fade-out 280ms ease-in forwards;
    }
    .popup-container {
      animation: dialog-in 180ms cubic-bezier(0.2, 0, 0, 1);
    }
    .popup-container.closing {
      animation: dialog-out 260ms cubic-bezier(0.3, 0, 0.8, 0.15) forwards;
    }
    .success-pop { animation: pop-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    @keyframes pop-in {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes dialog-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes dialog-out {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.97) translateY(4px); }
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
    @media (prefers-reduced-motion: reduce) {
      .popup-backdrop,
      .popup-backdrop.closing,
      .popup-container,
      .popup-container.closing,
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

  protected closing = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private exitTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private readonly keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.clearTimer();
      this.clearExitTimer();
      document.removeEventListener('keydown', this.keydownHandler);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      this.closing = false;
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', this.keydownHandler);
      this.clearTimer();
      this.timeoutId = setTimeout(() => this.beginClose(), this.durationMs);
    } else {
      this.teardown();
    }
  }

  protected get message(): string {
    return this.voteCount === 1
      ? 'Voto computado com sucesso!'
      : `${this.voteCount} votos computados com sucesso!`;
  }

  private beginClose(): void {
    if (this.closing) return;
    this.clearTimer();
    this.closing = true;
    this.cdr.markForCheck();
    this.exitTimeoutId = setTimeout(() => {
      this.teardown();
      this.closed.emit();
    }, EXIT_ANIMATION_MS);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.beginClose();
    }
  }

  private teardown(): void {
    this.closing = false;
    document.removeEventListener('keydown', this.keydownHandler);
    this.previouslyFocused?.focus?.();
    this.previouslyFocused = null;
    this.cdr.markForCheck();
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private clearExitTimer(): void {
    if (this.exitTimeoutId !== null) {
      clearTimeout(this.exitTimeoutId);
      this.exitTimeoutId = null;
    }
  }
}
