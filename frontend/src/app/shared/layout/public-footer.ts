import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="bg-surface-container-low border-t border-outline-variant mt-20">
      <div class="max-w-7xl mx-auto px-6 py-16 grid gap-12 md:grid-cols-3">
        <div>
          <p class="text-lg font-bold text-on-surface mb-3">Condo Vote</p>
          <p class="text-sm text-on-surface-variant max-w-sm">
            Assembleias virtuais com segurança jurídica para condomínios brasileiros.
          </p>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-on-surface mb-4">Navegação</h4>
          <ul class="space-y-3 text-sm text-on-surface-variant">
            <li><a href="#funcionalidades" class="hover:text-secondary transition-colors">Funcionalidades</a></li>
            <li><a href="#como-funciona" class="hover:text-secondary transition-colors">Como funciona</a></li>
            <li><a href="#faq" class="hover:text-secondary transition-colors">FAQ</a></li>
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-on-surface mb-4">Contato</h4>
          <p class="text-sm text-on-surface-variant">
            <a href="mailto:contato@condovote.com.br" class="hover:text-secondary transition-colors">
              contato&#64;condovote.com.br
            </a>
          </p>
        </div>
      </div>

      <div class="border-t border-outline-variant py-6 px-6 text-center">
        <p class="text-xs text-on-surface-variant">
          &copy; 2026 Condo Vote. Em conformidade com a Lei 14.309/22.
        </p>
      </div>
    </footer>
  `,
})
export class PublicFooter {}
