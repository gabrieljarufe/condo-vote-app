import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type PollStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'INVALIDATED' | 'CANCELLED';

@Component({
  selector: 'app-poll-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()">{{ label() }}</span>`,
})
export class PollStatusBadge {
  readonly status = input<string>('');

  protected readonly label = computed(() => {
    const labels: Record<PollStatus, string> = {
      DRAFT: 'Rascunho',
      SCHEDULED: 'Agendada',
      OPEN: 'Aberta',
      CLOSED: 'Encerrada',
      INVALIDATED: 'Invalidada',
      CANCELLED: 'Cancelada',
    };
    return labels[this.status() as PollStatus] ?? this.status();
  });

  protected readonly classes = computed(() => {
    const base = 'inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium';
    const colorMap: Record<PollStatus, string> = {
      DRAFT: 'bg-surface-container text-on-surface-variant',
      SCHEDULED: 'bg-blue-100 text-blue-700',
      OPEN: 'bg-green-100 text-green-700',
      CLOSED: 'bg-purple-100 text-purple-700',
      INVALIDATED: 'bg-amber-100 text-amber-700',
      CANCELLED: 'bg-error/10 text-error',
    };
    const color = colorMap[this.status() as PollStatus] ?? 'bg-surface-container text-on-surface-variant';
    return `${base} ${color}`;
  });
}
