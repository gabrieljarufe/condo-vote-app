import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { Dropdown, DropdownOption } from './dropdown';

@Component({
  selector: 'app-paginator',
  imports: [Dropdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      class="flex flex-wrap items-center justify-between gap-4 pt-4"
      aria-label="Paginação"
    >
      <div class="flex items-center gap-2 text-sm text-on-surface-variant">
        <span class="font-medium text-on-surface">Itens por página</span>
        <app-dropdown
          [options]="sizeOptions"
          [value]="size"
          ariaLabel="Itens por página"
          (valueChange)="onSizeChange($event)"
        />
      </div>

      <div class="flex items-center gap-3 text-sm">
        <span class="text-on-surface-variant" aria-live="polite">
          Página {{ currentPageLabel }} de {{ totalPagesLabel }} ·
          {{ totalElements }} {{ totalElements === 1 ? 'unidade' : 'unidades' }}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-sm hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
            [disabled]="isFirstPage"
            (click)="goPrevious()"
            aria-label="Página anterior"
          >
            « Anterior
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-sm hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed"
            [disabled]="isLastPage"
            (click)="goNext()"
            aria-label="Próxima página"
          >
            Próxima »
          </button>
        </div>
      </div>
    </nav>
  `,
})
export class Paginator {
  @Input() page = 0;
  @Input() size = 10;
  @Input() totalElements = 0;
  @Input() totalPages = 0;

  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly sizeChange = new EventEmitter<number>();

  protected readonly sizeOptions: ReadonlyArray<DropdownOption<number>> = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
  ];

  protected get isFirstPage(): boolean {
    return this.page <= 0;
  }
  protected get isLastPage(): boolean {
    return this.page >= this.totalPages - 1;
  }
  protected get currentPageLabel(): number {
    return this.totalPages === 0 ? 0 : this.page + 1;
  }
  protected get totalPagesLabel(): number {
    return Math.max(this.totalPages, 1);
  }

  protected goPrevious(): void {
    if (!this.isFirstPage) {
      this.pageChange.emit(this.page - 1);
    }
  }

  protected goNext(): void {
    if (!this.isLastPage) {
      this.pageChange.emit(this.page + 1);
    }
  }

  protected onSizeChange(value: number): void {
    if (Number.isFinite(value) && value > 0) {
      this.sizeChange.emit(value);
    }
  }
}
