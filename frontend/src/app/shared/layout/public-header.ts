import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="fixed top-0 left-0 right-0 z-50 h-16 bg-surface-container-lowest border-b border-outline-variant"
    >
      <div class="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <a routerLink="/" class="text-xl font-bold tracking-tight text-on-surface">Condo Vote</a>

        <nav class="hidden md:flex items-center gap-8" aria-label="Navegação principal">
          <a href="#funcionalidades" class="text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors">Funcionalidades</a>
          <a href="#como-funciona" class="text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors">Como funciona</a>
          <a href="#faq" class="text-sm font-medium text-on-surface-variant hover:text-secondary transition-colors">FAQ</a>
        </nav>

        <a
          routerLink="/login"
          class="inline-flex items-center px-5 py-2 rounded-lg bg-secondary text-on-secondary text-sm font-medium hover:brightness-110 transition-all"
        >
          Entrar
        </a>
      </div>
    </header>
  `,
})
export class PublicHeader {}
