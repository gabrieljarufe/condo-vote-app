import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';

@Component({
  selector: 'app-success-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-[fade-in_120ms_ease-out]"
        data-popup-backdrop
      >
        <div
          #container
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="success-popup-msg"
          class="bg-surface-container rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl animate-[dialog-in_140ms_ease-out]"
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
            <button
              #okBtn
              type="button"
              (click)="close()"
              (keydown.enter)="close()"
              class="mt-6 min-h-[44px] min-w-[88px] px-6 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .success-pop { animation: pop-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    @keyframes pop-in {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialog-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
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
  @Input() durationMs = 1800;
  @Output() readonly closed = new EventEmitter<void>();

  @ViewChild('okBtn') private okBtn?: ElementRef<HTMLButtonElement>;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private readonly keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.clearTimer();
      document.removeEventListener('keydown', this.keydownHandler);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', this.keydownHandler);
      // Focus OK button after Angular renders the @if block
      queueMicrotask(() => this.okBtn?.nativeElement?.focus());
      this.clearTimer();
      this.timeoutId = setTimeout(() => this.close(), this.durationMs);
    } else {
      this.teardown();
    }
  }

  protected close(): void {
    this.clearTimer();
    this.teardown();
    this.closed.emit();
  }

  protected get message(): string {
    return this.voteCount === 1
      ? 'Voto computado com sucesso!'
      : `${this.voteCount} votos computados com sucesso!`;
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  private teardown(): void {
    document.removeEventListener('keydown', this.keydownHandler);
    this.previouslyFocused?.focus?.();
    this.previouslyFocused = null;
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
