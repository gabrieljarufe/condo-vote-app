import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Apartment } from '../../../core/api/apartments-api.service';
import { BulkInvitationEntry, InvitationRole } from '../../../core/api/invitations-api.service';
import { Dropdown, DropdownOption } from '../../../shared/ui/dropdown';
import { ParsedRow } from './invitation-bulk-upload-form';

// Simplified email check: contains exactly one '@', something before and after, and a '.' after '@'
// Avoids slow-regex patterns while still catching the most common invalid inputs
function isValidEmail(email: string): boolean {
  const atIdx = email.indexOf('@');
  if (atIdx <= 0) return false;
  const domain = email.slice(atIdx + 1);
  return domain.length > 0 && domain.includes('.') && !email.includes(' ') && email.indexOf('@') === email.lastIndexOf('@');
}
const CPF_DIGITS_REGEX = /^\d{11}$/;
const VALID_ROLES: ReadonlySet<string> = new Set(['OWNER', 'TENANT']);

function validateRow(row: ParsedRow, apartments: readonly Apartment[]): string[] {
  const errors: string[] = [];

  if (!isValidEmail(row.email)) {
    errors.push('E-mail inválido');
  }

  const cpfClean = row.cpf.replace(/\D/g, '');
  if (!CPF_DIGITS_REGEX.test(cpfClean)) {
    errors.push('CPF deve ter 11 dígitos numéricos');
  }

  const aptMatch = apartments.find(
    (a) => (a.block ?? '') === row.block && a.unitNumber === row.unitNumber,
  );
  if (!aptMatch) {
    const loc =
      row.block
        ? `Bloco ${row.block} / ${row.unitNumber}`
        : row.unitNumber || '(vazio)';
    errors.push(`Apartamento ${loc} não encontrado`);
  }

  if (!VALID_ROLES.has(row.role)) {
    errors.push('Papel deve ser OWNER ou TENANT');
  }

  return errors;
}

@Component({
  selector: 'app-invitation-bulk-preview-grid',
  imports: [FormsModule, Dropdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">

      <!-- Contadores -->
      <div class="flex flex-wrap gap-3 text-sm">
        <span class="text-on-surface-variant">
          <strong class="text-on-surface">{{ totalCount() }}</strong> linhas lidas
        </span>
        <span class="text-green-700">
          <strong>{{ validCount() }}</strong> válidas
        </span>
        @if (errorCount() > 0) {
          <span class="text-error font-medium">
            {{ errorCount() }} com erros — corrija para enviar
          </span>
        }
      </div>

      <!-- Tabela -->
      @if (mutableRows().length > 0) {
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-outline-variant">
                <th class="px-2 py-2 text-left text-on-surface-variant font-medium w-8">#</th>
                <th class="px-2 py-2 text-left text-on-surface-variant font-medium">E-mail</th>
                <th class="px-2 py-2 text-left text-on-surface-variant font-medium">CPF</th>
                <th class="px-2 py-2 text-left text-on-surface-variant font-medium">Bloco</th>
                <th class="px-2 py-2 text-left text-on-surface-variant font-medium">Unidade</th>
                <th class="px-2 py-2 text-left text-on-surface-variant font-medium">Papel</th>
                <th class="px-2 py-2 text-center text-on-surface-variant font-medium w-8">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of mutableRows(); track row.rowIndex; let i = $index) {
                <tr
                  class="border-b border-outline-variant last:border-0"
                  [class.bg-error-container]="row.errors.length > 0"
                >
                  <td class="px-2 py-2 text-on-surface-variant text-xs">{{ row.rowIndex }}</td>

                  <!-- E-mail -->
                  <td class="px-2 py-1">
                    @if (row.errors.length > 0) {
                      <input
                        type="email"
                        [(ngModel)]="mutableRows()[i].email"
                        (ngModelChange)="revalidateRow(i)"
                        class="w-full min-w-[10rem] px-2 py-1 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-secondary"
                      />
                    } @else {
                      <span class="text-on-surface">{{ row.email }}</span>
                    }
                  </td>

                  <!-- CPF -->
                  <td class="px-2 py-1">
                    @if (row.errors.length > 0) {
                      <input
                        type="text"
                        [(ngModel)]="mutableRows()[i].cpf"
                        (ngModelChange)="revalidateRow(i)"
                        maxlength="14"
                        class="w-full min-w-[8rem] px-2 py-1 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-secondary"
                      />
                    } @else {
                      <span class="text-on-surface">{{ row.cpf }}</span>
                    }
                  </td>

                  <!-- Bloco -->
                  <td class="px-2 py-1">
                    @if (row.errors.length > 0) {
                      <input
                        type="text"
                        [(ngModel)]="mutableRows()[i].block"
                        (ngModelChange)="revalidateRow(i)"
                        class="w-full min-w-[4rem] px-2 py-1 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-secondary"
                      />
                    } @else {
                      <span class="text-on-surface">{{ row.block || '—' }}</span>
                    }
                  </td>

                  <!-- Unidade -->
                  <td class="px-2 py-1">
                    @if (row.errors.length > 0) {
                      <input
                        type="text"
                        [(ngModel)]="mutableRows()[i].unitNumber"
                        (ngModelChange)="revalidateRow(i)"
                        class="w-full min-w-[4rem] px-2 py-1 rounded border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-secondary"
                      />
                    } @else {
                      <span class="text-on-surface">{{ row.unitNumber }}</span>
                    }
                  </td>

                  <!-- Papel -->
                  <td class="px-2 py-1">
                    <app-dropdown
                      [options]="roleOptions"
                      [(ngModel)]="mutableRows()[i].role"
                      (valueChange)="revalidateRow(i)"
                      placeholder="— selecione —"
                    />
                  </td>

                  <!-- Status -->
                  <td class="px-2 py-2 text-center">
                    @if (row.errors.length === 0) {
                      <span class="text-green-700 text-base" title="Válido">✓</span>
                    } @else {
                      <span class="text-error text-base" title="Com erros">✗</span>
                    }
                  </td>
                </tr>

                <!-- Mensagens de erro por linha -->
                @if (row.errors.length > 0) {
                  <tr class="border-b border-outline-variant last:border-0 bg-error-container">
                    <td colspan="7" class="px-4 pb-2">
                      <ul class="flex flex-col gap-0.5">
                        @for (err of row.errors; track err) {
                          <li class="text-xs text-error">• {{ err }}</li>
                        }
                      </ul>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm text-on-surface-variant italic">Nenhuma linha encontrada.</p>
      }

      <!-- Aviso tudo-ou-nada -->
      <div class="rounded-xl bg-surface-container border border-outline-variant px-4 py-3 text-xs text-on-surface-variant flex gap-2">
        <span class="shrink-0">⚠</span>
        <span>O envio é <strong>tudo ou nada</strong> — se qualquer linha estiver inválida, nenhum convite será criado. Corrija todos os erros antes de enviar.</span>
      </div>

      <!-- Botões -->
      <div class="flex justify-between items-center pt-2">
        <div class="flex gap-2">
          <button
            type="button"
            [disabled]="disabled()"
            (click)="back.emit()"
            class="px-4 py-2 rounded-xl border border-outline-variant text-on-surface text-sm hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            ← Voltar
          </button>
          <button
            type="button"
            [disabled]="disabled()"
            (click)="cancel.emit()"
            class="px-4 py-2 rounded-xl text-on-surface-variant text-sm hover:underline disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>

        <button
          type="button"
          [disabled]="!allValid() || disabled()"
          (click)="onSubmit()"
          class="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          @if (disabled()) {
            Enviando…
          } @else {
            Enviar {{ validCount() }} convite{{ validCount() === 1 ? '' : 's' }}
          }
        </button>
      </div>

    </div>
  `,
})
export class InvitationBulkPreviewGrid {
  readonly rows = input<ParsedRow[]>([]);
  readonly apartments = input<readonly Apartment[]>([]);
  readonly disabled = input<boolean>(false);

  readonly back = output<void>();
  readonly cancel = output<void>();
  readonly submitBatch = output<BulkInvitationEntry[]>();

  protected readonly roleOptions: ReadonlyArray<DropdownOption<string>> = [
    { value: 'OWNER', label: 'OWNER' },
    { value: 'TENANT', label: 'TENANT' },
  ];

  protected readonly mutableRows = signal<ParsedRow[]>([]);

  protected readonly totalCount = computed(() => this.mutableRows().length);
  protected readonly validCount = computed(
    () => this.mutableRows().filter((r) => r.errors.length === 0).length,
  );
  protected readonly errorCount = computed(
    () => this.mutableRows().filter((r) => r.errors.length > 0).length,
  );
  protected readonly allValid = computed(
    () => this.mutableRows().length > 0 && this.errorCount() === 0,
  );

  constructor() {
    effect(() => {
      const incoming = this.rows();
      const apts = this.apartments();
      if (incoming.length > 0) {
        const validated = incoming.map((row) => ({
          ...row,
          errors: validateRow(row, apts),
        }));
        this.mutableRows.set(validated);
      }
    });
  }

  protected revalidateRow(index: number): void {
    this.mutableRows.update((rows) => {
      const updated = [...rows];
      const row = updated[index];
      if (row) {
        updated[index] = { ...row, errors: validateRow(row, this.apartments()) };
      }
      return updated;
    });
  }

  protected onSubmit(): void {
    if (!this.allValid() || this.disabled()) return;

    const entries: BulkInvitationEntry[] = this.mutableRows().map((row) => ({
      email: row.email,
      cpf: row.cpf.replace(/\D/g, ''),
      block: row.block || null,
      unitNumber: row.unitNumber,
      role: row.role as InvitationRole,
    }));

    this.submitBatch.emit(entries);
  }
}
