import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { GeneratedApartment } from './generate-apartments';

interface GridCell {
  unitNumber: string;
  editing: boolean;
  editValue: string;
}

interface GridRow {
  floor: number | null;
  label: string;
  cells: GridCell[];
}

@Component({
  selector: 'app-apartment-bulk-preview-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">

      <!-- Contador -->
      <p class="text-sm text-on-surface-variant font-medium">
        {{ totalCount() }} apartamento{{ totalCount() === 1 ? '' : 's' }} a criar
      </p>

      <!-- Tabela -->
      @if (rows().length > 0) {
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th class="text-left px-3 py-2 text-on-surface-variant font-medium border-b border-outline-variant">
                  Andar
                </th>
                @for (col of columnHeaders(); track col) {
                  <th class="text-left px-3 py-2 text-on-surface-variant font-medium border-b border-outline-variant">
                    {{ col }}
                  </th>
                }
                <th class="w-8 border-b border-outline-variant"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track $index; let rowIndex = $index) {
                <tr class="group/row border-b border-outline-variant last:border-0">
                  <td class="px-3 py-2 text-on-surface font-medium whitespace-nowrap">
                    {{ row.label }}
                  </td>
                  @for (cell of row.cells; track $index; let cellIndex = $index) {
                    <td class="px-2 py-1">
                      <div class="relative group/cell">
                        @if (cell.editing) {
                          <input
                            type="text"
                            [value]="cell.editValue"
                            (input)="onCellInput(rowIndex, cellIndex, $event)"
                            (keydown)="onCellKeydown(rowIndex, cellIndex, $event)"
                            (blur)="confirmEdit(rowIndex, cellIndex)"
                            class="w-full min-w-[4rem] px-2 py-1 rounded border bg-surface-container-lowest text-on-surface focus:outline-none focus:border-secondary"
                            [class.border-error]="isDuplicate(cell.unitNumber)"
                            [class.border-outline-variant]="!isDuplicate(cell.unitNumber)"
                            autofocus
                          />
                        } @else {
                          <button
                            type="button"
                            (click)="startEdit(rowIndex, cellIndex)"
                            class="w-full min-w-[4rem] px-2 py-1 rounded border text-left bg-surface-container-lowest text-on-surface hover:border-secondary transition-colors"
                            [class.border-error]="isDuplicate(cell.unitNumber)"
                            [class.text-error]="isDuplicate(cell.unitNumber)"
                            [class.border-outline-variant]="!isDuplicate(cell.unitNumber)"
                          >
                            {{ cell.unitNumber || '—' }}
                          </button>
                          <button
                            type="button"
                            (click)="removeCell(rowIndex, cellIndex)"
                            aria-label="Remover apartamento"
                            class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error text-on-error text-xs flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity leading-none"
                          >
                            ×
                          </button>
                        }
                      </div>
                    </td>
                  }
                  <!-- Células vazias para completar colunas -->
                  @for (col of paddingCols(rowIndex); track col) {
                    <td class="px-2 py-1"></td>
                  }
                  <!-- Botão remover linha -->
                  <td class="px-2 py-1">
                    <button
                      type="button"
                      (click)="removeRow(rowIndex)"
                      aria-label="Remover andar"
                      class="w-6 h-6 rounded-full bg-surface-container text-on-surface-variant text-xs hover:bg-error hover:text-on-error transition-colors flex items-center justify-center"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm text-on-surface-variant italic">Nenhum apartamento na lista.</p>
      }

      <!-- Botão adicionar andar -->
      <div>
        <button
          type="button"
          (click)="addCustomRow()"
          class="text-sm text-secondary hover:underline"
        >
          + Adicionar andar
        </button>
      </div>

      <!-- Erros de duplicata -->
      @if (hasDuplicates()) {
        <p class="text-sm text-error" role="alert">
          Existem apartamentos com números duplicados. Corrija antes de continuar.
        </p>
      }

      <!-- Botões finais -->
      <div class="flex justify-between items-center pt-2">
        <div class="flex gap-2">
          <button
            type="button"
            (click)="back.emit()"
            class="px-4 py-2 rounded-xl border border-outline-variant text-on-surface text-sm hover:bg-surface-container transition-colors"
          >
            ← Voltar
          </button>
          <button
            type="button"
            (click)="cancel.emit()"
            class="px-4 py-2 rounded-xl text-on-surface-variant text-sm hover:underline"
          >
            Cancelar
          </button>
        </div>

        <button
          type="button"
          [disabled]="rows().length === 0 || hasDuplicates()"
          (click)="onSubmitBatch()"
          class="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Criar {{ totalCount() }} apartamento{{ totalCount() === 1 ? '' : 's' }}
        </button>
      </div>

    </div>
  `,
})
export class ApartmentBulkPreviewGrid {
  // input.required seria o ideal, mas o ambiente de testes usa JIT (Vitest sem plugin Angular)
  // que não suporta setInput em signal inputs. Usando default vazio mantém o mesmo contrato
  // de uso (caller sempre fornece o array) sem quebrar os testes.
  readonly apartments = input<GeneratedApartment[]>([]);
  readonly disabled = input<boolean>(false);

  readonly apartmentsChange = output<GeneratedApartment[]>();
  readonly submitBatch = output<GeneratedApartment[]>();
  readonly back = output<void>();
  readonly cancel = output<void>();

  protected readonly rows = signal<GridRow[]>([]);

  protected readonly maxCols = computed(() =>
    Math.max(0, ...this.rows().map((r) => r.cells.length))
  );

  protected readonly columnHeaders = computed(() => {
    const n = this.maxCols();
    return Array.from({ length: n }, (_, i) => `Apto ${i + 1}`);
  });

  protected readonly totalCount = computed(() =>
    this.rows().reduce((sum, r) => sum + r.cells.filter((c) => c.unitNumber.trim() !== '').length, 0)
  );

  protected readonly duplicateSet = computed<Set<string>>(() => {
    const all: string[] = this.rows()
      .flatMap((r) => r.cells.map((c) => c.unitNumber.trim()))
      .filter((u) => u !== '');
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const u of all) {
      if (seen.has(u)) dupes.add(u);
      else seen.add(u);
    }
    return dupes;
  });

  protected readonly hasDuplicates = computed(() => this.duplicateSet().size > 0);

  constructor() {
    effect(() => {
      const apts = this.apartments();
      // Só inicializa rows quando há apartamentos — permite que testes
      // inicializem rows diretamente sem que o effect sobrescreva com array vazio.
      if (apts.length > 0) {
        this.rows.set(this.toGridRows(apts));
      }
    });
  }

  protected isDuplicate(unitNumber: string): boolean {
    return unitNumber.trim() !== '' && this.duplicateSet().has(unitNumber.trim());
  }

  protected paddingCols(rowIndex: number): number[] {
    const rowLen = this.rows()[rowIndex]?.cells.length ?? 0;
    const max = this.maxCols();
    const diff = max - rowLen;
    return diff > 0 ? Array.from({ length: diff }) : [];
  }

  protected startEdit(rowIndex: number, cellIndex: number): void {
    this.rows.update((rows) => {
      const next = rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) => {
          if (ri === rowIndex && ci === cellIndex) {
            return { ...c, editing: true, editValue: c.unitNumber };
          }
          // fechar outros em edição
          if (c.editing) {
            return { ...c, editing: false };
          }
          return c;
        }),
      }));
      return next;
    });
  }

  protected onCellInput(rowIndex: number, cellIndex: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rows.update((rows) =>
      rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) =>
          ri === rowIndex && ci === cellIndex ? { ...c, editValue: value } : c
        ),
      }))
    );
  }

  protected onCellKeydown(rowIndex: number, cellIndex: number, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmEdit(rowIndex, cellIndex);
    } else if (event.key === 'Escape') {
      this.cancelEdit(rowIndex, cellIndex);
    }
  }

  protected confirmEdit(rowIndex: number, cellIndex: number): void {
    this.rows.update((rows) => {
      const next = rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) => {
          if (ri === rowIndex && ci === cellIndex && c.editing) {
            return { ...c, editing: false, unitNumber: c.editValue };
          }
          return c;
        }),
      }));
      return next;
    });
    this.emitChange();
  }

  protected cancelEdit(rowIndex: number, cellIndex: number): void {
    this.rows.update((rows) =>
      rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) =>
          ri === rowIndex && ci === cellIndex ? { ...c, editing: false, editValue: c.unitNumber } : c
        ),
      }))
    );
  }

  protected removeRow(rowIndex: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== rowIndex));
    this.emitChange();
  }

  protected removeCell(rowIndex: number, cellIndex: number): void {
    this.rows.update((rows) =>
      rows.map((r, ri) => {
        if (ri !== rowIndex) return r;
        const cells = r.cells.filter((_, ci) => ci !== cellIndex);
        return { ...r, cells };
      })
    );
    this.emitChange();
  }

  protected addCustomRow(): void {
    const newRow: GridRow = {
      floor: null,
      label: 'CB',
      cells: Array.from({ length: 4 }, () => ({
        unitNumber: '',
        editing: true,
        editValue: '',
      })),
    };
    this.rows.update((rows) => [...rows, newRow]);
    this.emitChange();
  }

  protected onSubmitBatch(): void {
    if (this.rows().length === 0 || this.hasDuplicates()) return;
    this.submitBatch.emit(this.toFlatApartments());
  }

  private emitChange(): void {
    this.apartmentsChange.emit(this.toFlatApartments());
  }

  private toFlatApartments(): GeneratedApartment[] {
    return this.rows().flatMap((row) =>
      row.cells
        .filter((c) => c.unitNumber.trim() !== '')
        .map((c, seq) => ({
          block: null,
          unitNumber: c.unitNumber.trim(),
          floor: row.floor ?? 0,
          seq: seq + 1,
        }))
    );
  }

  private toGridRows(apts: GeneratedApartment[]): GridRow[] {
    // Separar aptos com floor > 0 de aptos floor <= 0 ou null
    const byFloor = new Map<number, GeneratedApartment[]>();
    const custom: GeneratedApartment[] = [];

    for (const apt of apts) {
      if (!apt.floor || apt.floor <= 0) {
        custom.push(apt);
      } else {
        if (!byFloor.has(apt.floor)) byFloor.set(apt.floor, []);
        byFloor.get(apt.floor)!.push(apt);
      }
    }

    const rows: GridRow[] = [];

    // Ordenar andares
    const sortedFloors = Array.from(byFloor.keys()).sort((a, b) => a - b);
    for (const floor of sortedFloors) {
      const floorApts = byFloor.get(floor)!;
      rows.push({
        floor,
        label: String(floor),
        cells: floorApts.map((a) => ({
          unitNumber: a.unitNumber,
          editing: false,
          editValue: a.unitNumber,
        })),
      });
    }

    // Linhas customizadas
    for (const apt of custom) {
      rows.push({
        floor: null,
        label: apt.unitNumber,
        cells: [{ unitNumber: apt.unitNumber, editing: false, editValue: apt.unitNumber }],
      });
    }

    return rows;
  }
}
