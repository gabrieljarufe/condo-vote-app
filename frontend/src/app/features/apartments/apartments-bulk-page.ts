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
import { AppHeader } from '../../shared/layout/app-header';
import { ApartmentBulkGeneratorForm } from './apartment-bulk-generator-form';
import { ApartmentBulkPreviewGrid } from './apartment-bulk-preview-grid';
import { GeneratedApartment } from './generate-apartments';

type BatchStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error';

@Component({
  selector: 'app-apartments-bulk-page',
  imports: [AppHeader, RouterLink, ApartmentBulkGeneratorForm, ApartmentBulkPreviewGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-4xl mx-auto px-6 py-12">
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
        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4">Configurar padrão</h2>
          <app-apartment-bulk-generator-form
            (generate)="onGenerate($event)"
          />
        </section>
      }

      <!-- Step 2: Preview + submit -->
      @if (step() === 'preview') {
        <!-- Banner de resultado -->
        @if (batchStatus() === 'success') {
          <div
            class="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between gap-4"
            role="status"
          >
            <p class="text-sm font-medium text-green-700">
              {{ batchResult()?.created?.length ?? 0 }} apartamento{{ (batchResult()?.created?.length ?? 0) === 1 ? '' : 's' }} criado{{ (batchResult()?.created?.length ?? 0) === 1 ? '' : 's' }} com sucesso.
            </p>
            <button
              type="button"
              (click)="navigateToApartments()"
              class="px-4 py-1.5 rounded-lg bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 whitespace-nowrap"
            >
              Ver lista
            </button>
          </div>
        }

        @if (batchStatus() === 'partial') {
          <div
            class="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 flex flex-col gap-2"
            role="status"
          >
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm font-medium text-yellow-700">
                {{ batchResult()?.created?.length ?? 0 }} criado{{ (batchResult()?.created?.length ?? 0) === 1 ? '' : 's' }},
                {{ batchResult()?.skipped?.length ?? 0 }} ignorado{{ (batchResult()?.skipped?.length ?? 0) === 1 ? '' : 's' }} (já existiam).
              </p>
              <button
                type="button"
                (click)="navigateToApartments()"
                class="px-4 py-1.5 rounded-lg bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 whitespace-nowrap"
              >
                Ver lista
              </button>
            </div>
            @if ((batchResult()?.skipped?.length ?? 0) > 0) {
              <details class="text-xs text-yellow-700">
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

        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
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

  protected readonly apartmentsLink = computed(() => {
    const id = this.tenant.activeCondominiumId();
    return id ? `/app/condominiums/${id}/apartments` : '/app';
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
          setTimeout(() => this.navigateToApartments(), 1500);
        } else {
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

  protected navigateToApartments(): void {
    const condoId = this.tenant.activeCondominiumId();
    void this.router.navigate(['/app/condominiums', condoId, 'apartments']);
  }
}
