import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';

/**
 * Toggle visual entre light e dark mode.
 *
 * Icon-only (44×44 target a11y); o ícone exibido é o do tema PRÓXIMO
 * (mostra "dark_mode" quando está em light), para comunicar o resultado
 * da ação — padrão de affordance comum (Material 3 Top App Bar).
 *
 * Acessibilidade: aria-label dinâmico descreve o destino do click;
 * focus-visible global trata o anel de foco; o material symbol é
 * decorativo (aria-hidden).
 */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="inline-flex items-center justify-center w-11 h-11 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
      [attr.aria-label]="ariaLabel()"
      [attr.title]="ariaLabel()"
      (click)="theme.toggle()"
    >
      <span class="material-symbols-outlined" aria-hidden="true">{{ icon() }}</span>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);

  protected readonly icon = computed(() =>
    this.theme.current() === 'dark' ? 'light_mode' : 'dark_mode'
  );

  protected readonly ariaLabel = computed(() =>
    this.theme.current() === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'
  );
}
