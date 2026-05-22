import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyPendingPollResponse } from '../../core/api/polls-api.service';

@Component({
  selector: 'app-pending-polls-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (polls.length === 0) {
      <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
        <p class="text-sm text-on-surface-variant py-4 text-center">
          Você não tem votações pendentes.
          <a
            (click)="seeInProgress.emit()"
            class="text-primary underline cursor-pointer ml-1"
            >Ver em andamento</a
          >
        </p>
      </section>
    } @else {
      <section class="flex flex-col gap-3">
        @for (p of polls; track p.pollId) {
          <article
            class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 flex items-center justify-between gap-4"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-on-surface truncate">{{ p.title }}</h3>
              <p class="text-xs text-on-surface-variant mt-1">
                {{ p.pendingBallotsCount }} de {{ p.totalBallotsCount }} cédula(s) pendente(s)
                · encerra {{ formatDate(p.scheduledEnd) }}
              </p>
            </div>
            <a
              [routerLink]="['/app/condominiums', condoId, 'polls', p.pollId, 'vote']"
              class="shrink-0 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold"
            >
              Votar →
            </a>
          </article>
        }
      </section>
    }
  `,
})
export class PendingPollsList {
  @Input({ required: true }) polls: ReadonlyArray<MyPendingPollResponse> = [];
  @Input({ required: true }) condoId = '';
  @Output() seeInProgress = new EventEmitter<void>();

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }
}
