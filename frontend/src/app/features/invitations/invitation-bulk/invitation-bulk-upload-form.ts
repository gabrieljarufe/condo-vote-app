import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import readXlsxFile from 'read-excel-file';

export interface ParsedRow {
  rowIndex: number;
  email: string;
  cpf: string;
  block: string;
  unitNumber: string;
  role: string;
  errors: string[];
}

@Component({
  selector: 'app-invitation-bulk-upload-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div>
        <p class="text-base font-semibold text-on-surface mb-1">
          Importar convites por planilha · Passo 1 de 2
        </p>
        <p class="text-sm text-on-surface-variant">
          Baixe o modelo, preencha os dados e faça o upload. O arquivo pode estar em formato
          <strong>.xlsx</strong> (Excel) ou <strong>.csv</strong>.
        </p>
      </div>

      <!-- Download template -->
      <div class="rounded-xl bg-surface-container border border-outline-variant px-4 py-4 flex flex-col gap-3">
        <p class="text-sm font-medium text-on-surface">1. Baixe o modelo</p>
        <button
          type="button"
          (click)="downloadTemplate()"
          class="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-sm hover:bg-surface-container-high transition-colors"
        >
          <span>⬇</span> Baixar modelo CSV
        </button>
        <p class="text-xs text-on-surface-variant">
          O arquivo CSV abre no Excel ou Google Sheets. Salve como .xlsx se preferir, ambos os formatos são aceitos no upload.
        </p>
      </div>

      <!-- Instruções -->
      <div class="rounded-xl bg-surface-container border border-outline-variant px-4 py-4 flex flex-col gap-2">
        <p class="text-sm font-medium text-on-surface">2. Preencha seguindo as regras</p>
        <ul class="text-sm text-on-surface-variant list-disc ml-4 flex flex-col gap-1">
          <li>A primeira linha é o cabeçalho — não remova.</li>
          <li>Colunas obrigatórias: <strong>email</strong>, <strong>cpf</strong>, <strong>bloco</strong>, <strong>unidade</strong>, <strong>papel</strong>.</li>
          <li>Campo <strong>bloco</strong>: use o mesmo valor cadastrado no condomínio (pode ficar vazio se não houver bloco).</li>
          <li>Campo <strong>papel</strong>: deve ser exatamente <strong>OWNER</strong> (proprietário) ou <strong>TENANT</strong> (inquilino).</li>
          <li>Campo <strong>cpf</strong>: apenas dígitos, sem pontos ou traços (11 dígitos).</li>
          <li>Limite: máximo de <strong>200 linhas</strong> por importação.</li>
        </ul>
      </div>

      <!-- Upload -->
      <div class="rounded-xl bg-surface-container border border-outline-variant px-4 py-4 flex flex-col gap-3">
        <p class="text-sm font-medium text-on-surface">3. Faça o upload do arquivo</p>

        <label
          class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-outline-variant rounded-xl px-6 py-8 cursor-pointer hover:border-secondary transition-colors"
          [class.border-error]="parseError()"
        >
          <span class="text-2xl">📂</span>
          <span class="text-sm text-on-surface-variant">
            {{ selectedFileName() || 'Clique para selecionar um arquivo .xlsx ou .csv' }}
          </span>
          <input
            type="file"
            accept=".xlsx,.csv"
            class="hidden"
            (change)="onFileSelected($event)"
          />
        </label>

        @if (parseError()) {
          <p class="text-xs text-error" role="alert">{{ parseError() }}</p>
        }

        @if (isParsing()) {
          <p class="text-xs text-on-surface-variant">Processando arquivo…</p>
        }
      </div>

      <!-- Botão cancelar -->
      <div class="flex justify-end">
        <button
          type="button"
          (click)="cancel.emit()"
          class="px-4 py-2 rounded-xl text-on-surface-variant text-sm hover:underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  `,
})
export class InvitationBulkUploadForm {
  readonly parsed = output<ParsedRow[]>();
  readonly cancel = output<void>();

  protected readonly selectedFileName = signal('');
  protected readonly parseError = signal('');
  protected readonly isParsing = signal(false);

  protected downloadTemplate(): void {
    const csv =
      'email,cpf,bloco,unidade,papel\n' +
      'morador@exemplo.com,12345678909,A,101,OWNER\n' +
      'inquilino@exemplo.com,98765432100,A,102,TENANT\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'convites-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedFileName.set(file.name);
    this.parseError.set('');
    this.isParsing.set(true);

    void this.parseFile(file)
      .then((rows) => {
        this.isParsing.set(false);
        if (rows.length === 0) {
          this.parseError.set('O arquivo está vazio ou contém apenas o cabeçalho.');
          return;
        }
        if (rows.length > 200) {
          this.parseError.set(
            `O arquivo tem ${rows.length} linhas. O limite é 200 por importação.`,
          );
          return;
        }
        this.parsed.emit(rows);
      })
      .catch((err: unknown) => {
        this.isParsing.set(false);
        this.parseError.set(
          err instanceof Error ? err.message : 'Erro ao processar o arquivo.',
        );
      });
  }

  private async parseFile(file: File): Promise<ParsedRow[]> {
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
    let rawRows: string[][];

    if (isXlsx) {
      const data = await readXlsxFile(file);
      rawRows = data.map((row) => row.map((cell) => String(cell ?? '')));
    } else {
      const text = await file.text();
      rawRows = text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) =>
          line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')),
        );
    }

    // Skip header row
    return rawRows.slice(1).map((row, i) => buildParsedRow(row, i));
  }
}

function buildParsedRow(row: string[], index: number): ParsedRow {
  return {
    rowIndex: index + 2,
    email: row[0] ?? '',
    cpf: row[1] ?? '',
    block: row[2] ?? '',
    unitNumber: row[3] ?? '',
    role: (row[4] ?? '').trim().toUpperCase(),
    errors: [],
  };
}
