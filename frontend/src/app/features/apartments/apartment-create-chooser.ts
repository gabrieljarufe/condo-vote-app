import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
} from '@angular/core';

@Component({
  selector: 'app-apartment-create-chooser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      (click)="onOverlayClick($event)"
      (keydown.escape)="close.emit()"
      role="dialog"
      aria-modal="true"
      aria-label="Escolha como adicionar apartamentos"
      tabindex="-1"
    >
      <div
        class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 max-w-md w-full mx-6"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-semibold text-on-surface mb-6">Adicionar apartamentos</h2>
        <div class="grid grid-cols-2 gap-4">
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
      </div>
    </div>
  `,
})
export class ApartmentCreateChooser implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly chooseOne = output<void>();
  readonly chooseBulk = output<void>();
  readonly close = output<void>();

  ngAfterViewInit(): void {
    const firstCard = this.el.nativeElement.querySelector<HTMLElement>('button');
    firstCard?.focus();
  }

  protected onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
