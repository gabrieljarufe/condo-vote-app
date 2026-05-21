import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PollResponse } from '../../core/api/polls-api.service';
import { Paginator } from '../../shared/ui/paginator';
import { PollStatusBadge } from './poll-status-badge';

const CONVOCATION_LABELS: Record<string, string> = {
  FIRST: '1ª Convocação',
  SECOND: '2ª Convocação',
};

const QUORUM_LABELS: Record<string, string> = {
  SIMPLE_MAJORITY: 'Maioria Simples',
  ABSOLUTE_MAJORITY: 'Maioria Absoluta',
  QUALIFIED_2_3: 'Qualificado 2/3',
  QUALIFIED_3_4: 'Qualificado 3/4',
};

@Component({
  selector: 'app-polls-table',
  imports: [RouterLink, Paginator, PollStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
      @if (totalElements === 0) {
        <p class="text-sm text-on-surface-variant py-4 text-center">{{ emptyMessage }}</p>
      } @else {
        <table class="w-full text-sm table-fixed">
          <thead>
            <tr class="border-b border-outline-variant text-left text-on-surface-variant">
              <th class="py-2 pr-4 font-medium w-2/5">Título</th>
              <th class="py-2 pr-4 font-medium w-1/8">Status</th>
              <th class="py-2 pr-4 font-medium w-1/6">Convocação</th>
              <th class="py-2 pr-4 font-medium w-1/6">Quórum</th>
              <th class="py-2 pr-2 font-medium w-1/8">Início</th>
              <th class="py-2 font-medium w-1/8">Fim</th>
            </tr>
          </thead>
          <tbody>
            @for (poll of polls; track poll.id) {
              <tr class="border-b border-outline-variant/50 hover:bg-surface-container-low">
                <td class="py-3 pr-4 truncate">
                  <a
                    [routerLink]="['./', poll.id]"
                    class="font-medium text-on-surface hover:text-secondary hover:underline"
                  >
                    {{ poll.title }}
                  </a>
                </td>
                <td class="py-3 pr-4">
                  <app-poll-status-badge [status]="poll.status" />
                </td>
                <td class="py-3 pr-4 text-on-surface-variant truncate">
                  {{ convocationLabel(poll) }}
                </td>
                <td class="py-3 pr-4 text-on-surface-variant truncate">
                  {{ quorumLabel(poll) }}
                </td>
                <td class="py-3 pr-2 text-on-surface-variant text-xs">
                  {{ formatDate(poll.scheduledStart) }}
                </td>
                <td class="py-3 text-on-surface-variant text-xs">
                  {{ formatDate(poll.scheduledEnd) }}
                </td>
              </tr>
            }
          </tbody>
        </table>

        <app-paginator
          [page]="page"
          [size]="size"
          [totalElements]="totalElements"
          [totalPages]="totalPages"
          (pageChange)="pageChange.emit($event)"
          (sizeChange)="sizeChange.emit($event)"
        />
      }
    </section>
  `,
})
export class PollsTable {
  @Input({ required: true }) polls: ReadonlyArray<PollResponse> = [];
  @Input({ required: true }) page = 0;
  @Input({ required: true }) size = 10;
  @Input({ required: true }) totalElements = 0;
  @Input({ required: true }) totalPages = 0;
  @Input() emptyMessage = 'Nenhuma votação encontrada.';
  @Output() pageChange = new EventEmitter<number>();
  @Output() sizeChange = new EventEmitter<number>();

  protected convocationLabel(poll: PollResponse): string {
    return CONVOCATION_LABELS[poll.convocation] ?? poll.convocation;
  }

  protected quorumLabel(poll: PollResponse): string {
    return QUORUM_LABELS[poll.quorumMode] ?? poll.quorumMode;
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }
}
