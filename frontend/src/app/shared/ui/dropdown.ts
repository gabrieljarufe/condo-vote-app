import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

let nextId = 0;

/**
 * Dropdown reutilizável com estilo M3.
 *
 * Suporta Reactive Forms (formControlName), Template-driven (ngModel)
 * e binding direto via [value]/(valueChange).
 *
 * Acessibilidade: combobox + listbox ARIA, navegação por teclado.
 */
@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Dropdown),
      multi: true,
    },
  ],
  template: `
    <div class="relative" #root>
      <button
        type="button"
        role="combobox"
        [id]="buttonId"
        [attr.aria-controls]="listboxId"
        [attr.aria-expanded]="isOpen"
        [attr.aria-label]="ariaLabel"
        [disabled]="isDisabled"
        class="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-left flex items-center justify-between gap-2 focus:outline-none focus:border-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        (click)="toggle()"
        (keydown)="onButtonKeydown($event)"
      >
        <span [class.text-on-surface-variant]="selectedLabel === null">
          {{ selectedLabel ?? placeholder }}
        </span>
        <svg
          class="w-4 h-4 transition-transform duration-150"
          [class.rotate-180]="isOpen"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      @if (isOpen) {
        <ul
          [id]="listboxId"
          role="listbox"
          [attr.aria-labelledby]="buttonId"
          class="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg py-1"
        >
          @for (opt of options; track opt.value; let i = $index) {
            <li
              role="option"
              [id]="listboxId + '-opt-' + i"
              [attr.aria-selected]="opt.value === value"
              [attr.aria-disabled]="opt.disabled || null"
              [class.bg-surface-container]="i === activeIndex"
              [class.opacity-50]="opt.disabled"
              [class.cursor-not-allowed]="opt.disabled"
              [class.cursor-pointer]="!opt.disabled"
              [class.font-medium]="opt.value === value"
              class="px-4 py-2 text-sm text-on-surface hover:bg-surface-container"
              (click)="selectOption(opt)"
              (mouseenter)="activeIndex = i"
            >
              {{ opt.label }}
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class Dropdown<T = unknown> implements ControlValueAccessor {
  @Input() options: ReadonlyArray<DropdownOption<T>> = [];
  @Input() placeholder = 'Selecione…';
  @Input() ariaLabel: string | null = null;
  @Input() set disabled(v: boolean) {
    this.disabledInput = v;
  }
  @Input() set value(v: T | null) {
    this.internalValue = v;
  }
  get value(): T | null {
    return this.internalValue;
  }
  @Output() readonly valueChange = new EventEmitter<T>();

  @ViewChild('root', { static: true }) private root!: ElementRef<HTMLElement>;

  private readonly elementRef = inject(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly id = nextId++;
  protected readonly buttonId = `app-dd-btn-${this.id}`;
  protected readonly listboxId = `app-dd-list-${this.id}`;

  protected isOpen = false;
  protected activeIndex = -1;
  protected internalValue: T | null = null;
  private disabledInput = false;
  private disabledByForm = false;

  private onChange: (v: T | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected get isDisabled(): boolean {
    return this.disabledInput || this.disabledByForm;
  }

  protected get selectedLabel(): string | null {
    const found = this.options.find((o) => o.value === this.internalValue);
    return found?.label ?? null;
  }

  writeValue(v: T | null): void {
    this.internalValue = v;
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (v: T | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabledByForm = disabled;
    this.cdr.markForCheck();
  }

  protected toggle(): void {
    if (this.isDisabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.activeIndex = this.options.findIndex((o) => o.value === this.internalValue);
    }
  }

  protected selectOption(opt: DropdownOption<T>): void {
    if (opt.disabled) return;
    this.internalValue = opt.value;
    this.isOpen = false;
    this.onChange(opt.value);
    this.onTouched();
    this.valueChange.emit(opt.value);
  }

  protected onButtonKeydown(event: KeyboardEvent): void {
    if (this.isDisabled) return;
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.isOpen) {
          this.toggle();
        } else if (this.activeIndex >= 0) {
          this.selectOption(this.options[this.activeIndex]);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen) this.toggle();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.isOpen) this.toggle();
        this.moveActive(-1);
        break;
      case 'Home':
        if (this.isOpen) {
          event.preventDefault();
          this.activeIndex = this.firstEnabledIndex();
        }
        break;
      case 'End':
        if (this.isOpen) {
          event.preventDefault();
          this.activeIndex = this.lastEnabledIndex();
        }
        break;
      case 'Escape':
        if (this.isOpen) {
          event.preventDefault();
          this.isOpen = false;
        }
        break;
      case 'Tab':
        this.isOpen = false;
        break;
    }
  }

  private moveActive(delta: number): void {
    const n = this.options.length;
    if (n === 0) return;
    let i = this.activeIndex;
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      if (!this.options[i].disabled) {
        this.activeIndex = i;
        return;
      }
    }
  }

  private firstEnabledIndex(): number {
    return this.options.findIndex((o) => !o.disabled);
  }
  private lastEnabledIndex(): number {
    for (let i = this.options.length - 1; i >= 0; i--) {
      if (!this.options[i].disabled) return i;
    }
    return -1;
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.onTouched();
    }
  }
}
