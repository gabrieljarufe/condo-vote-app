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
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-outline-variant text-left text-on-surface-variant">
            <th class="py-2 pr-4 font-medium">Bloco</th>
            <th class="py-2 pr-4 font-medium">Unidade</th>
            <th class="py-2 pr-4 font-medium">Inadimplente</th>
            <th class="py-2 font-medium">Ação</th>
          </tr>
        </thead>
        <tbody>
          @for (apt of apartments(); track apt.id) {
            <tr class="border-b border-outline-variant/50 hover:bg-surface-container-low">
              <td class="py-3 pr-4">{{ apt.block ?? '—' }}</td>
              <td class="py-3 pr-4 font-medium">{{ apt.unitNumber }}</td>
              <td class="py-3 pr-4">
                <span
                  [class]="
                    apt.isDelinquent
                      ? 'inline-flex items-center px-2 py-0.5 rounded text-xs bg-error/10 text-error'
                      : 'inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-container text-on-surface-variant'
                  "
                >
                  {{ apt.isDelinquent ? 'Sim' : 'Não' }}
                </span>
              </td>
              <td class="py-3">
                <button
                  type="button"
                  (click)="toggleDelinquent.emit(apt)"
                  class="text-xs text-secondary hover:underline"
                >
                  {{ apt.isDelinquent ? 'Remover inadimplência' : 'Marcar inadimplente' }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class ApartmentList {
  readonly apartments = input<readonly Apartment[]>([]);
  readonly toggleDelinquent = output<Apartment>();
}
