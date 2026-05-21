import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { Dialog } from '../../shared/ui/dialog';

@Component({
  selector: 'app-apartment-create-chooser',
  standalone: true,
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [open]="true" ariaLabelledBy="apt-chooser-title" (closed)="close.emit()">
      <h2 dialog-title id="apt-chooser-title" class="text-lg font-semibold text-on-surface mb-6">
        Adicionar apartamentos
      </h2>
      <div dialog-body class="grid grid-cols-2 gap-4">
        <button
          type="button"
          class="cursor-pointer rounded-xl border border-outline-variant p-5 hover:bg-surface-container-low text-left transition-colors"
          (click)="chooseOne.emit()"
        >
          <div class="text-2xl mb-2">🏠</div>
          <div class="text-sm font-medium text-on-surface">Adicionar 1 apartamento</div>
          <div class="text-xs text-on-surface-variant mt-1">Cadastre uma unidade individual</div>
        </button>

        <button
          type="button"
          class="cursor-pointer rounded-xl border border-outline-variant p-5 hover:bg-surface-container-low text-left transition-colors"
          (click)="chooseBulk.emit()"
        >
          <div class="text-2xl mb-2">🏢</div>
          <div class="text-sm font-medium text-on-surface">Adicionar vários (gerador)</div>
          <div class="text-xs text-on-surface-variant mt-1">Gere apartamentos a partir de um padrão</div>
        </button>
      </div>
    </app-dialog>
  `,
})
export class ApartmentCreateChooser {
  @Output() readonly chooseOne = new EventEmitter<void>();
  @Output() readonly chooseBulk = new EventEmitter<void>();
  @Output() readonly close = new EventEmitter<void>();
}
