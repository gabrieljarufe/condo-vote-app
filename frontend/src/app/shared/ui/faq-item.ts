import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

let nextId = 0;

/**
 * Acordeão de FAQ acessível.
 * - aria-expanded refletindo estado
 * - aria-controls + id para vincular pergunta ao painel
 * - keyboard navigation via <button> nativa
 */
@Component({
  selector: 'app-faq-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .faq-body {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .faq-body.open {
      grid-template-rows: 1fr;
    }
    .faq-body-inner {
      overflow: hidden;
    }
    .faq-chevron {
      transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .faq-chevron.rotate {
      transform: rotate(180deg);
    }
  `],
  template: `
    <div class="border border-outline-variant rounded-xl">
      <button
        type="button"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="panelId"
        (click)="toggle()"
        class="w-full flex items-center justify-between p-6 text-left cursor-pointer"
      >
        <span class="text-base font-semibold text-on-surface">{{ question() }}</span>
        <span
          class="material-symbols-outlined text-on-surface-variant faq-chevron"
          [class.rotate]="expanded()"
          aria-hidden="true"
        >expand_more</span>
      </button>
      <div
        class="faq-body"
        [class.open]="expanded()"
        [attr.aria-hidden]="expanded() ? null : 'true'"
      >
        <div class="faq-body-inner">
          <div [id]="panelId" class="px-6 pb-6 text-sm text-on-surface-variant leading-relaxed">
            <ng-content />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class FaqItem {
  readonly question = input.required<string>();

  protected readonly panelId = `faq-panel-${nextId++}`;
  protected readonly expanded = signal(false);
  protected readonly _ = computed(() => this.expanded());

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }
}
