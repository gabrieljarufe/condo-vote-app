import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Dialog } from './dialog';

/**
 * Diálogo de confirmação reutilizável.
 *
 * Implementa o padrão ARIA APG `alertdialog` — o foco inicial vai ao botão
 * secundário (Cancelar) para ações destrutivas, conforme §4.5 do redesign-proposal.
 *
 * Uso básico:
 *   <app-confirm-dialog
 *     [open]="show()"
 *     title="Encerrar votação?"
 *     body="Após encerrar, nenhum novo voto será aceito."
 *     variant="danger"
 *     confirmLabel="Encerrar"
 *     (confirmed)="doClose()"
 *     (cancelled)="show.set(false)"
 *   />
 *
 * Com consentimento explícito (para ações especialmente graves):
 *   <app-confirm-dialog
 *     [open]="show()"
 *     title="Publicar votação?"
 *     body="A votação ficará visível para os moradores."
 *     [requireExplicitConsent]="true"
 *     (confirmed)="doPublish()"
 *     (cancelled)="show.set(false)"
 *   />
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog
      [open]="open"
      [closeOnBackdrop]="false"
      ariaLabelledBy="confirm-dialog-title"
      (closed)="onCancel()"
    >
      <div dialog-title>
        <h2
          id="confirm-dialog-title"
          class="text-lg font-semibold text-on-surface"
          [attr.role]="'alertdialog'"
        >
          {{ title }}
        </h2>
      </div>

      <div dialog-body class="mt-3">
        <p class="text-sm text-on-surface-variant">{{ body }}</p>

        @if (requireExplicitConsent) {
          <label class="flex items-start gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              class="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary/30"
              [checked]="consentChecked"
              (change)="consentChecked = !consentChecked"
            />
            <span class="text-sm text-on-surface">
              Eu entendo que esta ação não pode ser desfeita
            </span>
          </label>
        }
      </div>

      <div dialog-actions class="flex justify-end gap-3 pt-5">
        <!-- Botão cancelar vem PRIMEIRO no DOM e recebe foco inicial (APG alertdialog) -->
        <button
          #cancelBtn
          id="confirm-dialog-cancel"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium border border-outline-variant text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          (click)="onCancel()"
        >
          {{ cancelLabel }}
        </button>

        <button
          type="button"
          [attr.aria-describedby]="'confirm-dialog-title'"
          [disabled]="requireExplicitConsent && !consentChecked"
          [class]="confirmButtonClass()"
          (click)="onConfirm()"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </app-dialog>
  `,
})
export class ConfirmDialog implements OnChanges {
  /** Texto do título do diálogo (obrigatório). */
  @Input() title = '';

  /** Texto descritivo do corpo do diálogo (obrigatório). */
  @Input() body = '';

  /** Rótulo do botão de confirmação. */
  @Input() confirmLabel = 'Confirmar';

  /** Rótulo do botão de cancelamento. */
  @Input() cancelLabel = 'Cancelar';

  /**
   * `danger` → botão de confirmação em vermelho (bg-error).
   * `default` → botão de confirmação em azul primário (bg-primary).
   */
  @Input() variant: 'default' | 'danger' = 'default';

  /** Controla a visibilidade do diálogo. */
  @Input() open = false;

  /**
   * Quando `true`, exibe checkbox "Eu entendo que esta ação não pode ser desfeita"
   * que precisa ser marcado antes de habilitar o botão de confirmação.
   */
  @Input() requireExplicitConsent = false;

  /** Emitido quando o usuário confirma a ação. */
  @Output() readonly confirmed = new EventEmitter<void>();

  /** Emitido quando o usuário cancela (botão, Esc ou backdrop). */
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Estado interno do checkbox de consentimento. */
  protected consentChecked = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) {
      // Reseta consentimento ao fechar para não vazar entre aberturas.
      this.consentChecked = false;
    }
  }

  protected confirmButtonClass(): string {
    const base =
      'px-4 py-2 rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:cursor-not-allowed';
    if (this.variant === 'danger') {
      return `${base} bg-error text-white hover:opacity-90 focus-visible:ring-error/40`;
    }
    return `${base} bg-primary text-white hover:opacity-90 focus-visible:ring-primary/40`;
  }

  protected onConfirm(): void {
    if (this.requireExplicitConsent && !this.consentChecked) return;
    this.confirmed.emit();
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
