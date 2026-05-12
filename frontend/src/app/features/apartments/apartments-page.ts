import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Apartment, ApartmentsApiService, CreateApartmentRequest } from '../../core/api/apartments-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';
import { ApartmentCreateChooser } from './apartment-create-chooser';
import { ApartmentForm } from './apartment-form';
import { ApartmentList } from './apartment-list';

type PageState = 'loading' | 'error' | 'ready';

@Component({
  selector: 'app-apartments-page',
  imports: [AppHeader, Spinner, ApartmentList, ApartmentForm, ApartmentCreateChooser, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-4xl mx-auto px-6 py-12">
      <div class="flex items-center gap-3 mb-8">
        <a [routerLink]="dashboardLink()" class="text-sm text-on-surface-variant hover:text-on-surface">
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
                (click)="showChooser.set(true)"
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

        @if (showChooser()) {
          <app-apartment-create-chooser
            (chooseOne)="onChooseOne()"
            (chooseBulk)="onChooseBulk()"
            (close)="showChooser.set(false)"
          />
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
  private readonly router = inject(Router);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly apartments = signal<readonly Apartment[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly showForm = signal(false);
  protected readonly showChooser = signal(false);
  protected readonly dashboardLink = computed(() => {
    const id = this.tenant.activeCondominiumId();
    return id ? `/app/condominiums/${id}` : '/app';
  });

  ngOnInit(): void {
    const condoId = this.tenant.activeCondominiumId()!;
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

  protected onChooseOne(): void {
    this.showChooser.set(false);
    this.showForm.set(true);
  }

  protected onChooseBulk(): void {
    const condoId = this.tenant.activeCondominiumId();
    this.showChooser.set(false);
    void this.router.navigate(['/app/condominiums', condoId, 'apartments', 'bulk']);
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
