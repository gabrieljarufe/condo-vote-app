import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center gap-2 text-on-surface-variant" role="status" aria-live="polite">
      <span
        class="inline-block w-4 h-4 border-2 border-outline-variant border-t-secondary rounded-full animate-spin"
        aria-hidden="true"
      ></span>
      <span class="text-sm">{{ label() }}</span>
    </div>
  `,
})
export class Spinner {
  readonly label = input<string>('Carregando…');
}
