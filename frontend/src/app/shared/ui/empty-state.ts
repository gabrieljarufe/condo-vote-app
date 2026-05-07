import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center text-center py-12 px-6">
      <span
        class="material-symbols-outlined text-on-surface-variant mb-4"
        style="font-size: 48px;"
        aria-hidden="true"
      >{{ icon() }}</span>
      <h3 class="text-lg font-semibold text-on-surface mb-2">{{ title() }}</h3>
      @if (description(); as desc) {
        <p class="text-sm text-on-surface-variant max-w-md">{{ desc }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
}
