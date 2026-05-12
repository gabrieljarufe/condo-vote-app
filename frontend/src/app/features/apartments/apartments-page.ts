import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Apartment, ApartmentsApiService, CreateApartmentRequest } from '../../core/api/apartments-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';
import { ApartmentForm } from './apartment-form';
import { ApartmentList } from './apartment-list';

type PageState = 'loading' | 'error' | 'ready';

@Component({
  selector: 'app-apartments-page',
  imports: [AppHeader, Spinner, ApartmentList, ApartmentForm, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-4xl mx-auto px-6 py-12">
      <div class="flex items-center gap-3 mb-8">
        <a routerLink="/app" class="text-sm text-on-surface-variant hover:text-on-surface">
          ← Início
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Apartamentos</h1>
      </div>

      @if (pageState() === 'loading') {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando apartamentos…" />
        </div>
      } @else if (pageState() === 'error') {
        <p class="text-sm text-error py-4" role="alert">{{ errorMessage() }}</p>
      } @else {
        <div class="flex flex-col gap-8">
          <section
            class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6"
          >
            <h2 class="text-lg font-semibold text-on-surface mb-4">Lista de unidades</h2>
            <app-apartment-list
              [apartments]="apartments()"
              (toggleDelinquent)="onToggleDelinquent($event)"
            />
          </section>

          @if (!showForm()) {
            <div class="flex justify-end">
              <button
                type="button"
                (click)="showForm.set(true)"
                class="px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium hover:opacity-90"
              >
                + Novo apartamento
              </button>
            </div>
          } @else {
            <section
              class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6"
            >
              <h2 class="text-lg font-semibold text-on-surface mb-4">Cadastrar apartamento</h2>
              <app-apartment-form
                #apartmentForm
                (submit)="onCreateApartment($event)"
                (cancel)="showForm.set(false)"
              />
            </section>
          }
        </div>
      }
    </main>
  `,
})
export default class ApartmentsPage implements OnInit {
  @ViewChild('apartmentForm') private readonly form?: ApartmentForm;

  private readonly api = inject(ApartmentsApiService);
  private readonly tenant = inject(TenantService);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly apartments = signal<readonly Apartment[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly showForm = signal(false);

  ngOnInit(): void {
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) {
      this.errorMessage.set('Nenhum condomínio ativo. Volte e selecione um condomínio.');
      this.pageState.set('error');
      return;
    }
    this.api.list(condoId).subscribe({
      next: (data) => {
        this.apartments.set(data);
        this.pageState.set('ready');
      },
      error: (e: unknown) => {
        this.errorMessage.set(e instanceof Error ? e.message : 'Erro ao carregar apartamentos.');
        this.pageState.set('error');
      },
    });
  }

  protected onCreateApartment(request: CreateApartmentRequest): void {
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) return;
    this.api.create(condoId, request).subscribe({
      next: (created) => {
        this.showForm.set(false);
        const sorted = [...this.apartments(), created].sort((a, b) => {
          const blockCmp = (a.block ?? '').localeCompare(b.block ?? '');
          return blockCmp !== 0 ? blockCmp : a.unitNumber.localeCompare(b.unitNumber);
        });
        this.apartments.set(sorted);
      },
      error: () => {
        this.form?.setError('Erro ao cadastrar. Verifique se a unidade já existe neste bloco.');
      },
    });
  }

  protected onToggleDelinquent(apt: Apartment): void {
    this.api.setDelinquent(apt.id, !apt.isDelinquent).subscribe({
      next: (updated) => {
        this.apartments.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
      },
    });
  }
}
