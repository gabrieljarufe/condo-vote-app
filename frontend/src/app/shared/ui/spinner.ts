import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-6 h-6 border-[3px]',
};

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.inline-flex]': '!inline()',
    '[class.items-center]': '!inline()',
    '[class.gap-2]': '!inline()',
    '[class.text-on-surface-variant]': '!inline()',
    '[class.contents]': 'inline()',
    role: 'status',
    'aria-live': 'polite',
  },
  template: `
    <span
      class="inline-block border-current/30 border-t-current rounded-full animate-spin align-middle"
      [class]="iconClasses()"
      aria-hidden="true"
    ></span>
    <span [class]="inline() ? 'sr-only' : 'text-sm'">{{ label() }}</span>
  `,
})
export class Spinner {
  readonly label = input<string>('Carregando…');
  readonly size = input<SpinnerSize>('sm');
  readonly inline = input<boolean>(false);

  protected readonly iconClasses = computed(() => SIZE_CLASSES[this.size()]);
}
