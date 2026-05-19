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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog modal reutilizável.
 *
 * Uso:
 *   <app-dialog [open]="show()" (closed)="show.set(false)" ariaLabelledBy="my-title">
 *     <h2 dialog-title id="my-title">Título</h2>
 *     <p dialog-body>Conteúdo</p>
 *     <div dialog-actions><button (click)="show.set(false)">Cancelar</button></div>
 *   </app-dialog>
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-[fade-in_120ms_ease-out]"
        (click)="onBackdropClick()"
        data-dialog-backdrop
      >
        <div
          #container
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="ariaLabelledBy"
          class="bg-surface-container rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl animate-[dialog-in_140ms_ease-out]"
          (click)="$event.stopPropagation()"
        >
          <ng-content select="[dialog-title]" />
          <ng-content select="[dialog-body]" />
          <ng-content select="[dialog-actions]" />
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialog-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `,
})
export class Dialog implements OnChanges {
  @Input() open = false;
  @Input() closeOnEsc = true;
  @Input() closeOnBackdrop = true;
  @Input() ariaLabelledBy: string | null = null;
  @Output() readonly closed = new EventEmitter<void>();

  @ViewChild('container') protected container?: ElementRef<HTMLElement>;

  private previouslyFocused: HTMLElement | null = null;
  private readonly keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', this.keydownHandler);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open) {
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', this.keydownHandler);
      queueMicrotask(() => this.focusFirst());
    } else {
      document.removeEventListener('keydown', this.keydownHandler);
      this.previouslyFocused?.focus?.();
      this.previouslyFocused = null;
    }
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.closed.emit();
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.closeOnEsc) {
      event.preventDefault();
      this.closed.emit();
      return;
    }
    if (event.key === 'Tab') {
      this.handleTab(event);
    }
  }

  private focusable(): HTMLElement[] {
    const el = this.container?.nativeElement;
    if (!el) return [];
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  private focusFirst(): void {
    const first = this.focusable()[0];
    first?.focus();
  }

  private handleTab(event: KeyboardEvent): void {
    const items = this.focusable();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
