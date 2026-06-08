import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { getRoleChipAriaLabel, getRoleChipLabel } from './role-chip';

/**
 * Barra de navegação inferior — só mobile (`sm:hidden`). No desktop o
 * `AppHeader` cobre a navegação; aqui ela reaparece como bottom nav porque
 * no celular o header esconde os links (`hidden sm:inline-flex`).
 *
 * Itens role-aware: reusa a mesma lógica de `AppHeader` (condo ativo via
 * `TenantService`, links derivados de `activeCondominiumId`). "Mais" abre um
 * bottom sheet com nome do condo, chip de papel, Trocar e Sair — os itens que
 * vivem no header em telas largas.
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest border-t border-outline-variant pb-[env(safe-area-inset-bottom)]"
      role="navigation"
      aria-label="Navegação principal"
    >
      <ul class="flex items-stretch justify-around">
        <li class="flex-1">
          <a
            [routerLink]="homeLink()"
            routerLinkActive="text-primary"
            [routerLinkActiveOptions]="{ exact: true }"
            #homeRla="routerLinkActive"
            [attr.aria-current]="homeRla.isActive ? 'page' : null"
            class="flex flex-col items-center justify-center gap-0.5 min-h-14 text-on-surface-variant"
          >
            <span class="material-symbols-outlined" aria-hidden="true">home</span>
            <span class="text-xs">Início</span>
          </a>
        </li>
        @if (pollsLink(); as pl) {
          <li class="flex-1">
            <a
              [routerLink]="pl"
              routerLinkActive="text-primary"
              #pollsRla="routerLinkActive"
              [attr.aria-current]="pollsRla.isActive ? 'page' : null"
              class="flex flex-col items-center justify-center gap-0.5 min-h-14 text-on-surface-variant"
            >
              <span class="material-symbols-outlined" aria-hidden="true">how_to_vote</span>
              <span class="text-xs">Votações</span>
            </a>
          </li>
        }
        @if (apartmentsLink(); as al) {
          <li class="flex-1">
            <a
              [routerLink]="al"
              routerLinkActive="text-primary"
              #aptRla="routerLinkActive"
              [attr.aria-current]="aptRla.isActive ? 'page' : null"
              class="flex flex-col items-center justify-center gap-0.5 min-h-14 text-on-surface-variant"
            >
              <span class="material-symbols-outlined" aria-hidden="true">apartment</span>
              <span class="text-xs">Apartamentos</span>
            </a>
          </li>
        }
        <li class="flex-1">
          <button
            type="button"
            (click)="toggleMore()"
            [attr.aria-expanded]="moreOpen()"
            class="w-full flex flex-col items-center justify-center gap-0.5 min-h-14 text-on-surface-variant"
          >
            <span class="material-symbols-outlined" aria-hidden="true">menu</span>
            <span class="text-xs">Mais</span>
          </button>
        </li>
      </ul>
    </nav>

    @if (moreOpen()) {
      <div class="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Mais opções">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="closeMore()" aria-hidden="true"></div>
        <div
          class="absolute bottom-0 inset-x-0 bg-surface-container rounded-t-2xl border-t border-outline-variant p-5 pb-[calc(env(safe-area-inset-bottom)_+_1.25rem)] flex flex-col gap-3"
        >
          @if (activeCondoName(); as condoName) {
            <div class="flex items-center gap-2 text-sm text-on-surface">
              <span class="material-symbols-outlined text-base" aria-hidden="true">apartment</span>
              {{ condoName }}
            </div>
          }
          @if (roleChipLabel(); as label) {
            <span
              class="self-start inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container"
              role="status"
              [attr.aria-label]="roleChipAriaLabel()"
            >
              {{ label }}
            </span>
          }
          @if (canSwitchCondo()) {
            <button
              type="button"
              (click)="switchCondo()"
              class="flex items-center gap-2 min-h-11 text-sm text-primary"
            >
              <span class="material-symbols-outlined text-base" aria-hidden="true">swap_horiz</span>
              Trocar condomínio
            </button>
          }
          <button
            type="button"
            (click)="signOut()"
            class="flex items-center gap-2 min-h-11 text-sm text-on-surface-variant"
          >
            <span class="material-symbols-outlined text-base" aria-hidden="true">logout</span>
            Sair
          </button>
        </div>
      </div>
    }
  `,
})
export class BottomNav {
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  readonly condominiums = input<readonly { id: string; name: string }[]>([]);

  protected readonly moreOpen = signal(false);

  protected readonly homeLink = computed(() => {
    const condoId = this.tenant.activeCondominiumId();
    return condoId ? `/app/condominiums/${condoId}` : '/app';
  });

  protected readonly apartmentsLink = computed(() => {
    const condoId = this.tenant.activeCondominiumId();
    return condoId ? `/app/condominiums/${condoId}/apartments` : null;
  });

  protected readonly pollsLink = computed(() => {
    const condoId = this.tenant.activeCondominiumId();
    return condoId ? `/app/condominiums/${condoId}/polls` : null;
  });

  protected readonly canSwitchCondo = computed(
    () => this.tenant.isAdmin() || this.condominiums().length > 1,
  );

  protected readonly activeCondoName = computed(() => {
    const id = this.tenant.activeCondominiumId();
    if (!id) return null;
    return this.condominiums().find((c) => c.id === id)?.name ?? null;
  });

  protected readonly roleChipLabel = computed(() => getRoleChipLabel(this.tenant.activeRoles()));
  protected readonly roleChipAriaLabel = computed(() =>
    getRoleChipAriaLabel(this.tenant.activeRoles()),
  );

  protected toggleMore(): void {
    this.moreOpen.update((v) => !v);
  }

  protected closeMore(): void {
    this.moreOpen.set(false);
  }

  protected switchCondo(): void {
    this.closeMore();
    this.tenant.clear();
    void this.router.navigateByUrl('/app');
  }

  protected async signOut(): Promise<void> {
    this.closeMore();
    await this.auth.signOut();
    this.tenant.clear();
    await this.router.navigateByUrl('/login');
  }
}
