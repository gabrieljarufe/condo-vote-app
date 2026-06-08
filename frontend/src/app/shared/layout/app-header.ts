import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { ThemeToggle } from '../ui/theme-toggle';
import { getOrderedRoles, getRoleChipAriaLabel, getRoleChipLabel } from './role-chip';

@Component({
  selector: 'app-app-header',
  imports: [RouterLink, RouterLinkActive, ThemeToggle],
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
            @if (roleChipLabel(); as label) {
              <span
                class="hidden sm:inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container"
                role="status"
                [attr.aria-label]="roleChipAriaLabel()"
              >
                {{ label }}
              </span>
            }
            @if (apartmentsLink()) {
              <a
                [routerLink]="apartmentsLink()"
                routerLinkActive="text-primary font-semibold"
                class="hidden sm:inline-flex text-sm text-on-surface-variant hover:text-on-surface"
              >
                Apartamentos
              </a>
            }
            @if (pollsLink()) {
              <a
                [routerLink]="pollsLink()"
                routerLinkActive="text-primary font-semibold"
                class="hidden sm:inline-flex text-sm text-on-surface-variant hover:text-on-surface"
              >
                Votações
              </a>
            }
            @if (canSwitchCondo()) {
              <button
                type="button"
                (click)="switchCondo()"
                class="hidden sm:inline-flex text-sm text-primary hover:underline"
              >
                Trocar
              </button>
            }
          }
          <app-theme-toggle />
          <button
            type="button"
            (click)="signOut()"
            class="hidden sm:inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
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

  protected readonly canSwitchCondo = computed(
    () => this.tenant.isAdmin() || this.condominiums().length > 1,
  );

  protected readonly activeCondoName = computed(() => {
    const id = this.tenant.activeCondominiumId();
    if (!id) return null;
    return this.condominiums().find((c) => c.id === id)?.name ?? null;
  });

  protected readonly apartmentsLink = computed(() => {
    const condoId = this.tenant.activeCondominiumId();
    return condoId ? `/app/condominiums/${condoId}/apartments` : null;
  });

  protected readonly pollsLink = computed(() => {
    const condoId = this.tenant.activeCondominiumId();
    return condoId ? `/app/condominiums/${condoId}/polls` : null;
  });

  protected readonly orderedRoles = computed(() => getOrderedRoles(this.tenant.activeRoles()));
  protected readonly roleChipLabel = computed(() => getRoleChipLabel(this.tenant.activeRoles()));
  protected readonly roleChipAriaLabel = computed(() =>
    getRoleChipAriaLabel(this.tenant.activeRoles()),
  );

  protected switchCondo(): void {
    this.tenant.clear();
    void this.router.navigateByUrl('/app');
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.tenant.clear();
    await this.router.navigateByUrl('/login');
  }
}
