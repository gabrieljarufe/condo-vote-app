import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Apartment } from '../../core/api/apartments-api.service';

@Component({
  selector: 'app-apartment-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (apartments().length === 0) {
      <p class="text-sm text-on-surface-variant py-4 text-center">
        Nenhum apartamento cadastrado.
      </p>
    } @else {
      <table class="hidden sm:table w-full text-sm table-fixed">
        <thead>
          <tr class="border-b border-outline-variant text-center text-on-surface-variant">
            <th class="py-2 pr-4 font-medium w-1/5">Bloco</th>
            <th class="py-2 pr-4 font-medium w-1/5">Unidade</th>
            <th class="py-2 pr-4 font-medium w-1/5">Inadimplente</th>
            <th class="py-2 font-medium w-2/5">Ação</th>
          </tr>
        </thead>
        <tbody>
          @for (apt of apartments(); track apt.id) {
            <tr class="border-b border-outline-variant/50 hover:bg-surface-container-low text-center">
              <td class="py-3 pr-4 truncate">{{ apt.block ?? '—' }}</td>
              <td class="py-3 pr-4 font-medium truncate">{{ apt.unitNumber }}</td>
              <td class="py-3 pr-4">
                <span
                  [class]="
                    apt.isDelinquent
                      ? 'inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded text-xs bg-error/10 text-error'
                      : 'inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded text-xs bg-surface-container text-on-surface-variant'
                  "
                >
                  {{ apt.isDelinquent ? 'Sim' : 'Não' }}
                </span>
              </td>
              <td class="py-3">
                <button
                  type="button"
                  (click)="toggleDelinquent.emit(apt)"
                  class="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  {{ apt.isDelinquent ? 'Remover inadimplência' : 'Marcar inadimplente' }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <ul class="flex flex-col gap-3 sm:hidden">
        @for (apt of apartments(); track apt.id) {
          <li class="rounded-xl border border-outline-variant p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-3">
              <p class="font-medium text-on-surface">
                {{ apt.block ? apt.block + ' · ' + apt.unitNumber : apt.unitNumber }}
              </p>
              <span
                [class]="
                  apt.isDelinquent
                    ? 'inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded text-xs bg-error/10 text-error'
                    : 'inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded text-xs bg-surface-container text-on-surface-variant'
                "
              >
                {{ apt.isDelinquent ? 'Inadimplente' : 'Adimplente' }}
              </span>
            </div>
            <button
              type="button"
              (click)="toggleDelinquent.emit(apt)"
              class="w-full min-h-11 px-3 rounded-lg border border-outline-variant text-sm text-primary hover:bg-surface-container-low whitespace-nowrap"
            >
              {{ apt.isDelinquent ? 'Remover inadimplência' : 'Marcar inadimplente' }}
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class ApartmentList {
  readonly apartments = input<readonly Apartment[]>([]);
  readonly toggleDelinquent = output<Apartment>();
}
