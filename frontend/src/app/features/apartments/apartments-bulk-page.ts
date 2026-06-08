import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ApartmentsApiService,
  BatchCreateResponse,
  CreateApartmentRequest,
} from '../../core/api/apartments-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SuccessPopup } from '../../shared/ui/success-popup';
import { ApartmentBulkGeneratorForm } from './apartment-bulk-generator-form';
import { ApartmentBulkPreviewGrid } from './apartment-bulk-preview-grid';
import { GeneratedApartment } from './generate-apartments';

type BatchStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error';

@Component({
  selector: 'app-apartments-bulk-page',
  imports: [
    RouterLink,
    ApartmentBulkGeneratorForm,
    ApartmentBulkPreviewGrid,
    SuccessPopup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-8">
        <a
          [routerLink]="apartmentsLink()"
          class="text-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Apartamentos
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Cadastro em lote</h1>
      </div>

      <!-- Step 1: Configurar padrão -->
      @if (step() === 'pattern') {
        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 sm:p-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4">Configurar padrão</h2>
          <app-apartment-bulk-generator-form
            (generate)="onGenerate($event)"
          />
        </section>
      }

      <!-- Step 2: Preview + submit -->
      @if (step() === 'preview') {
        <!-- Banner de resultado parcial (sucesso usa modal app-success-popup ao final) -->
        @if (batchStatus() === 'partial' && partialVisible()) {
          <div
            class="mb-4 rounded-xl border border-warning-container bg-warning-container/60 px-4 py-3 flex flex-col gap-2 transition-opacity duration-300"
            [class.opacity-0]="partialFading()"
            role="status"
          >
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm font-medium text-on-warning-container">
                {{ batchResult()?.created?.length ?? 0 }} criado{{ (batchResult()?.created?.length ?? 0) === 1 ? '' : 's' }},
                {{ batchResult()?.skipped?.length ?? 0 }} ignorado{{ (batchResult()?.skipped?.length ?? 0) === 1 ? '' : 's' }} (já existiam).
              </p>
              <button
                type="button"
                (click)="dismissPartial()"
                aria-label="Fechar"
                class="text-on-warning-container/70 hover:text-on-warning-container transition-colors shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            @if ((batchResult()?.skipped?.length ?? 0) > 0) {
              <details class="text-xs text-on-warning-container">
                <summary class="cursor-pointer hover:underline">Ver ignorados</summary>
                <ul class="mt-1 ml-4 list-disc">
                  @for (item of batchResult()?.skipped ?? []; track item.unitNumber) {
                    <li>
                      {{ item.block ? item.block + ' / ' : '' }}{{ item.unitNumber }}
                    </li>
                  }
                </ul>
              </details>
            }
          </div>
        }

        @if (batchStatus() === 'error') {
          <div
            class="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3"
            role="alert"
          >
            <p class="text-sm font-medium text-error">{{ batchError() }}</p>
          </div>
        }

        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 sm:p-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4">Revisar apartamentos</h2>
          <app-apartment-bulk-preview-grid
            [apartments]="generatedApartments()"
            [disabled]="batchStatus() === 'loading'"
            (back)="step.set('pattern')"
            (cancel)="navigateToApartments()"
            (submitBatch)="onSubmitBatch($event)"
          />
        </section>
      }
    </main>

    <app-success-popup
      [open]="batchStatus() === 'success'"
      [message]="successMessage()"
      [durationMs]="1600"
      (closed)="navigateToApartments()"
    />
  `,
})
export default class ApartmentsBulkPage {
  private readonly api = inject(ApartmentsApiService);
  protected readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  protected readonly step = signal<'pattern' | 'preview'>('pattern');
  protected readonly generatedApartments = signal<GeneratedApartment[]>([]);
  protected readonly batchStatus = signal<BatchStatus>('idle');
  protected readonly batchResult = signal<BatchCreateResponse | null>(null);
  protected readonly batchError = signal('');
  protected readonly partialVisible = signal(true);
  protected readonly partialFading = signal(false);

  protected readonly apartmentsLink = computed(() => {
    const id = this.tenant.activeCondominiumId();
    return id ? `/app/condominiums/${id}/apartments` : '/app';
  });

  protected readonly successMessage = computed(() => {
    const count = this.batchResult()?.created?.length ?? 0;
    return count === 1
      ? '1 apartamento criado com sucesso!'
      : `${count} apartamentos criados com sucesso!`;
  });

  protected onGenerate(apartments: GeneratedApartment[]): void {
    this.generatedApartments.set(apartments);
    this.step.set('preview');
  }

  protected onSubmitBatch(apartments: GeneratedApartment[]): void {
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) return;

    this.batchStatus.set('loading');

    const items: CreateApartmentRequest[] = apartments.map((a) => ({
      unitNumber: a.unitNumber,
      block: a.block ?? undefined,
    }));

    this.api.createBatch(condoId, { items }).subscribe({
      next: (response) => {
        this.batchResult.set(response);
        if (response.skipped.length === 0) {
          this.batchStatus.set('success');
          // Navegação acontece em (closed) do <app-success-popup>,
          // depois da animação de saída (~280ms) — transição suave.
        } else {
          this.partialVisible.set(true);
          this.partialFading.set(false);
          this.batchStatus.set('partial');
        }
      },
      error: (e: unknown) => {
        this.batchStatus.set('error');
        this.batchError.set(
          e instanceof Error ? e.message : 'Erro ao criar apartamentos.',
        );
      },
    });
  }

  protected dismissPartial(): void {
    this.partialFading.set(true);
    setTimeout(() => this.partialVisible.set(false), 300);
  }

  protected navigateToApartments(): void {
    const condoId = this.tenant.activeCondominiumId();
    void this.router.navigate(['/app/condominiums', condoId, 'apartments']);
  }
}
