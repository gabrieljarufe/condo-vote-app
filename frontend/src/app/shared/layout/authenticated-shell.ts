import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { catchError, map, startWith } from 'rxjs';
import { MeApiService, UserCondominium } from '../../core/api/me-api.service';
import { AppHeader } from './app-header';
import { BottomNav } from './bottom-nav';

/**
 * Layout shell das rotas autenticadas (`/app/condominiums/:condoId/**`).
 *
 * Renderiza o header UMA ÚNICA VEZ + o `<router-outlet>` dos filhos + a
 * bottom nav (mobile). Antes deste shell, cada página renderizava seu próprio
 * `<app-app-header>`; agora elas só renderizam o `<main>` e o header/bottom-nav
 * vivem aqui. Carrega os condomínios do usuário uma vez e injeta em ambos.
 */
@Component({
  selector: 'app-authenticated-shell',
  imports: [RouterOutlet, AppHeader, BottomNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header [condominiums]="condos()" />
    <div class="pb-20 sm:pb-0">
      <router-outlet />
    </div>
    <app-bottom-nav [condominiums]="condos()" />
  `,
})
export default class AuthenticatedShell {
  protected readonly condos = toSignal(
    inject(MeApiService).getCondominiums().pipe(
      map((condos): readonly UserCondominium[] => condos),
      catchError((): (readonly UserCondominium[])[] => [[]]),
      startWith<readonly UserCondominium[]>([]),
    ),
    { initialValue: [] as readonly UserCondominium[] },
  );
}
