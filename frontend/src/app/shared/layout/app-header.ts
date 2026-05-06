import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';

/**
 * Header da área autenticada (/app).
 * Exibe o condomínio ativo (se houver) e ações de trocar / sair.
 */
@Component({
  selector: 'app-app-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="h-16 bg-surface-container-lowest border-b border-outline-variant">
      <div class="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <a routerLink="/app" class="text-xl font-bold tracking-tight text-on-surface">Condo Vote</a>

        <div class="flex items-center gap-4">
          @if (activeCondoName(); as condoName) {
            <span class="hidden sm:inline-flex items-center gap-2 text-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-base" aria-hidden="true">apartment</span>
              {{ condoName }}
            </span>
            <button
              type="button"
              (click)="switchCondo()"
              class="text-sm text-secondary hover:underline"
            >
              Trocar
            </button>
          }
          <button
            type="button"
            (click)="signOut()"
            class="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
          >
            <span class="material-symbols-outlined text-base" aria-hidden="true">logout</span>
            Sair
          </button>
        </div>
      </div>
    </header>
  `,
})
export class AppHeader {
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  readonly condominiums = input<readonly { id: string; name: string }[]>([]);

  protected readonly activeCondoName = computed(() => {
    const id = this.tenant.activeCondominiumId();
    if (!id) return null;
    return this.condominiums().find((c) => c.id === id)?.name ?? null;
  });

  protected switchCondo(): void {
    this.tenant.clear();
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.tenant.clear();
    await this.router.navigateByUrl('/login');
  }
}
