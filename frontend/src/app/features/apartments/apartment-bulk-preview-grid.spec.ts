import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { ApartmentBulkPreviewGrid } from './apartment-bulk-preview-grid';
import { GeneratedApartment } from './generate-apartments';

// Tipos internos (reproduzidos aqui para uso nos testes)
interface GridCell {
  unitNumber: string;
  editing: boolean;
  editValue: string;
}

interface GridRow {
  floor: number | null;
  label: string;
  cells: GridCell[];
  block: string | null;
}

function makeApts(floorCount: number, perFloor: number): GeneratedApartment[] {
  const apts: GeneratedApartment[] = [];
  for (let f = 1; f <= floorCount; f++) {
    for (let s = 1; s <= perFloor; s++) {
      apts.push({
        block: null,
        unitNumber: `${f}0${s}`,
        floor: f,
        seq: s,
      });
    }
  }
  return apts;
}

function makeRows(apts: GeneratedApartment[]): GridRow[] {
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
  for (const floor of Array.from(byFloor.keys()).sort((a, b) => a - b)) {
    const floorApts = byFloor.get(floor)!;
    rows.push({
      floor,
      label: String(floor),
      block: floorApts[0]?.block ?? null,
      cells: floorApts.map((a) => ({
        unitNumber: a.unitNumber,
        editing: false,
        editValue: a.unitNumber,
      })),
    });
  }
  for (const apt of custom) {
    rows.push({
      floor: null,
      label: apt.unitNumber,
      block: apt.block,
      cells: [{ unitNumber: apt.unitNumber, editing: false, editValue: apt.unitNumber }],
    });
  }
  return rows;
}

/**
 * Cria o componente com rows inicializadas diretamente no signal interno,
 * contornando a limitação do JIT (setInput não funciona com signal inputs em Vitest).
 */
async function setup(apts: GeneratedApartment[] = makeApts(2, 2)) {
  await TestBed.configureTestingModule({
    imports: [ApartmentBulkPreviewGrid],
  }).compileComponents();

  const fixture = TestBed.createComponent(ApartmentBulkPreviewGrid);
  // Inicializar rows diretamente via signal antes do primeiro detectChanges
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comp = fixture.componentInstance as any;
  comp.rows.set(makeRows(apts));
  fixture.detectChanges();

  const el: HTMLElement = fixture.nativeElement;
  return { fixture, comp, el };
}

describe('ApartmentBulkPreviewGrid', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('agrupa aptos por andar — 4 aptos em 2 andares geram 2 linhas', async () => {
    const { comp } = await setup(makeApts(2, 2));
    const rows: GridRow[] = comp.rows();
    expect(rows.length).toBe(2);
    expect(rows[0].label).toBe('1');
    expect(rows[1].label).toBe('2');
  });

  it('totalCount retorna N correto', async () => {
    const { comp } = await setup(makeApts(2, 2));
    expect(comp.totalCount()).toBe(4);
  });

  it('startEdit coloca célula em modo edição', async () => {
    const { comp } = await setup(makeApts(1, 1));
    expect(comp.rows()[0].cells[0].editing).toBe(false);

    comp.startEdit(0, 0);

    expect(comp.rows()[0].cells[0].editing).toBe(true);
    expect(comp.rows()[0].cells[0].editValue).toBe(comp.rows()[0].cells[0].unitNumber);
  });

  it('confirmEdit salva novo valor e sai do modo edição', async () => {
    const { comp } = await setup(makeApts(1, 1));
    const originalUnit: string = comp.rows()[0].cells[0].unitNumber;

    comp.startEdit(0, 0);
    comp.rows.update((rows: GridRow[]) =>
      rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) =>
          ri === 0 && ci === 0 ? { ...c, editValue: '999' } : c
        ),
      }))
    );
    comp.confirmEdit(0, 0);

    const cell: GridCell = comp.rows()[0].cells[0];
    expect(cell.editing).toBe(false);
    expect(cell.unitNumber).toBe('999');
    expect(cell.unitNumber).not.toBe(originalUnit);
  });

  it('cancelEdit restaura valor original sem salvar', async () => {
    const { comp } = await setup(makeApts(1, 1));
    const originalUnit: string = comp.rows()[0].cells[0].unitNumber;

    comp.startEdit(0, 0);
    comp.rows.update((rows: GridRow[]) =>
      rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) =>
          ri === 0 && ci === 0 ? { ...c, editValue: 'ZZZ' } : c
        ),
      }))
    );
    comp.cancelEdit(0, 0);

    const cell: GridCell = comp.rows()[0].cells[0];
    expect(cell.editing).toBe(false);
    expect(cell.unitNumber).toBe(originalUnit);
  });

  it('removeRow remove linha e totalCount atualiza', async () => {
    const { comp } = await setup(makeApts(2, 2));

    expect(comp.rows().length).toBe(2);
    expect(comp.totalCount()).toBe(4);

    comp.removeRow(0);

    expect(comp.rows().length).toBe(1);
    expect(comp.totalCount()).toBe(2);
  });

  it('removeCell remove apto individual e totalCount atualiza', async () => {
    const { comp } = await setup(makeApts(1, 2));

    expect(comp.totalCount()).toBe(2);

    comp.removeCell(0, 0);

    expect(comp.totalCount()).toBe(1);
  });

  it('duplicata → hasDuplicates true e isDuplicate retorna true para o valor duplicado', async () => {
    const apts: GeneratedApartment[] = [
      { block: null, unitNumber: '101', floor: 1, seq: 1 },
      { block: null, unitNumber: '101', floor: 2, seq: 1 }, // duplicata!
    ];
    const { comp } = await setup(apts);

    expect(comp.hasDuplicates()).toBe(true);
    expect(comp.duplicateSet().has('101')).toBe(true);
    expect(comp.isDuplicate('101')).toBe(true);
  });

  it('reverter duplicata → hasDuplicates false', async () => {
    const apts: GeneratedApartment[] = [
      { block: null, unitNumber: '101', floor: 1, seq: 1 },
      { block: null, unitNumber: '101', floor: 2, seq: 1 },
    ];
    const { comp } = await setup(apts);

    expect(comp.hasDuplicates()).toBe(true);

    comp.rows.update((rows: GridRow[]) =>
      rows.map((r, i) => {
        if (i === 1) {
          return {
            ...r,
            cells: r.cells.map((c) => ({ ...c, unitNumber: '201', editValue: '201' })),
          };
        }
        return r;
      })
    );

    expect(comp.hasDuplicates()).toBe(false);
    expect(comp.isDuplicate('101')).toBe(false);
  });

  it('addCustomRow adiciona linha com label CB, floor null e 4 células em edição', async () => {
    const { comp } = await setup(makeApts(1, 2));

    expect(comp.rows().length).toBe(1);

    comp.addCustomRow();

    const rows: GridRow[] = comp.rows();
    expect(rows.length).toBe(2);
    const newRow = rows[1];
    expect(newRow.label).toBe('CB');
    expect(newRow.floor).toBeNull();
    expect(newRow.cells.length).toBe(4);
    expect(newRow.cells[0].editing).toBe(true);
  });

  it('onSubmitBatch emite submitBatch com array flat quando não há duplicatas', async () => {
    const { comp, fixture } = await setup(makeApts(2, 2));

    const emitted: GeneratedApartment[][] = [];
    fixture.componentInstance.submitBatch.subscribe((v: GeneratedApartment[]) => emitted.push(v));

    comp.onSubmitBatch();

    expect(emitted.length).toBe(1);
    expect(emitted[0].length).toBe(4);
  });

  it('onSubmitBatch preserva block nos apartamentos emitidos', async () => {
    const apts: GeneratedApartment[] = [
      { block: 'A', unitNumber: '101', floor: 1, seq: 1 },
      { block: 'A', unitNumber: '102', floor: 1, seq: 2 },
      { block: 'A', unitNumber: '201', floor: 2, seq: 1 },
    ];
    const { comp, fixture } = await setup(apts);

    const emitted: GeneratedApartment[][] = [];
    fixture.componentInstance.submitBatch.subscribe((v: GeneratedApartment[]) => emitted.push(v));

    comp.onSubmitBatch();

    expect(emitted.length).toBe(1);
    expect(emitted[0].every((a) => a.block === 'A')).toBe(true);
  });

  it('onSubmitBatch preserva block null quando bloco não foi informado', async () => {
    const { comp, fixture } = await setup(makeApts(1, 2));

    const emitted: GeneratedApartment[][] = [];
    fixture.componentInstance.submitBatch.subscribe((v: GeneratedApartment[]) => emitted.push(v));

    comp.onSubmitBatch();

    expect(emitted.length).toBe(1);
    expect(emitted[0].every((a) => a.block === null)).toBe(true);
  });

  it('onSubmitBatch não emite quando há duplicatas', async () => {
    const apts: GeneratedApartment[] = [
      { block: null, unitNumber: '101', floor: 1, seq: 1 },
      { block: null, unitNumber: '101', floor: 2, seq: 1 },
    ];
    const { comp, fixture } = await setup(apts);

    const emitted: GeneratedApartment[][] = [];
    fixture.componentInstance.submitBatch.subscribe((v: GeneratedApartment[]) => emitted.push(v));

    comp.onSubmitBatch();

    expect(emitted.length).toBe(0);
  });

  it('maxCols retorna o maior número de células entre as linhas', async () => {
    const apts: GeneratedApartment[] = [
      { block: null, unitNumber: '101', floor: 1, seq: 1 },
      { block: null, unitNumber: '102', floor: 1, seq: 2 },
      { block: null, unitNumber: '103', floor: 1, seq: 3 },
      { block: null, unitNumber: '201', floor: 2, seq: 1 },
    ];
    const { comp } = await setup(apts);

    // Andar 1 tem 3 células, andar 2 tem 1 — maxCols deve ser 3
    expect(comp.maxCols()).toBe(3);
  });

  it('onCellKeydown com Enter confirma edição', async () => {
    const { comp } = await setup(makeApts(1, 1));

    comp.startEdit(0, 0);
    comp.rows.update((rows: GridRow[]) =>
      rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) =>
          ri === 0 && ci === 0 ? { ...c, editValue: 'XYZ' } : c
        ),
      }))
    );

    const mockEvent = { key: 'Enter', preventDefault: () => {} } as KeyboardEvent;
    comp.onCellKeydown(0, 0, mockEvent);

    expect(comp.rows()[0].cells[0].unitNumber).toBe('XYZ');
    expect(comp.rows()[0].cells[0].editing).toBe(false);
  });

  it('onCellKeydown com Escape cancela edição', async () => {
    const { comp } = await setup(makeApts(1, 1));
    const original = comp.rows()[0].cells[0].unitNumber;

    comp.startEdit(0, 0);
    comp.rows.update((rows: GridRow[]) =>
      rows.map((r, ri) => ({
        ...r,
        cells: r.cells.map((c, ci) =>
          ri === 0 && ci === 0 ? { ...c, editValue: 'DIFFERENT' } : c
        ),
      }))
    );

    const mockEvent = { key: 'Escape', preventDefault: () => {} } as KeyboardEvent;
    comp.onCellKeydown(0, 0, mockEvent);

    expect(comp.rows()[0].cells[0].unitNumber).toBe(original);
    expect(comp.rows()[0].cells[0].editing).toBe(false);
  });
});
