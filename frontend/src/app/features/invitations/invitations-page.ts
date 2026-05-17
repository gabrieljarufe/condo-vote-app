import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Apartment, ApartmentsApiService } from '../../core/api/apartments-api.service';
import {
  CreateInvitationRequest,
  Invitation,
  InvitationStatus,
  InvitationsApiService,
} from '../../core/api/invitations-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';
import { InvitationIndividualForm } from './invitation-individual-form';
import { InvitationList } from './invitation-list';

type PageState = 'loading' | 'error' | 'ready';

@Component({
  selector: 'app-invitations-page',
  imports: [
    AppHeader,
    Spinner,
    InvitationList,
    InvitationIndividualForm,
    RouterLink,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-5xl mx-auto px-6 py-12">
      <div class="flex items-center gap-3 mb-8">
        <a [routerLink]="dashboardLink()" class="text-sm text-on-surface-variant hover:text-on-surface">
          ← Início
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Convites</h1>
      </div>

      @if (pageState() === 'loading') {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando convites…" />
        </div>
      } @else if (pageState() === 'error') {
        <p class="text-sm text-error py-4" role="alert">{{ errorMessage() }}</p>
      } @else {
        <div class="flex flex-col gap-8">

          <!-- Filtros -->
          <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4">
            <div class="flex flex-wrap gap-4 items-end">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-on-surface-variant">Status</label>
                <select
                  [(ngModel)]="filterStatus"
                  (ngModelChange)="onFilterChange()"
                  class="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:border-secondary"
                >
                  <option value="">Todos</option>
                  <option value="PENDING">Pendente</option>
                  <option value="ACCEPTED">Aceito</option>
                  <option value="REVOKED">Revogado</option>
                  <option value="EXPIRED">Expirado</option>
                  <option value="BOUNCED">Rebounced</option>
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-on-surface-variant">Apartamento</label>
                <select
                  [(ngModel)]="filterApartmentId"
                  (ngModelChange)="onFilterChange()"
                  class="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:border-secondary"
                >
                  <option value="">Todos</option>
                  @for (apt of apartments(); track apt.id) {
                    <option [value]="apt.id">
                      {{ apt.block ? 'Bloco ' + apt.block + ' · ' + apt.unitNumber : apt.unitNumber }}
                    </option>
                  }
                </select>
              </div>
            </div>
          </section>

          <!-- Lista -->
          <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
            <h2 class="text-lg font-semibold text-on-surface mb-4">Lista de convites</h2>
            <app-invitation-list
              [invitations]="invitations()"
              [apartments]="apartments()"
              (resend)="onResend($event)"
              (revoke)="onRevoke($event)"
              (fixEmail)="onFixEmail($event)"
            />
          </section>

          <!-- Botões de ação -->
          @if (!showForm()) {
            <div class="flex justify-end gap-3">
              <button
                type="button"
                (click)="navigateToBulk()"
                class="px-5 py-2.5 rounded-xl border border-secondary text-secondary text-sm font-medium hover:bg-secondary/5"
              >
                Importar planilha (XLSX)
              </button>
              <button
                type="button"
                (click)="showForm.set(true)"
                class="px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium hover:opacity-90"
              >
                + Convite individual
              </button>
            </div>
          } @else {
            <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
              <h2 class="text-lg font-semibold text-on-surface mb-4">Novo convite</h2>
              <app-invitation-individual-form
                #invitationForm
                [apartments]="apartments()"
                (formSubmit)="onCreate($event)"
                (cancel)="showForm.set(false)"
              />
            </section>
          }

        </div>
      }
    </main>
  `,
})
export default class InvitationsPage implements OnInit {
  @ViewChild('invitationForm') private readonly form?: InvitationIndividualForm;

  private readonly api = inject(InvitationsApiService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly invitations = signal<readonly Invitation[]>([]);
  protected readonly apartments = signal<readonly Apartment[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly showForm = signal(false);

  protected filterStatus = '';
  protected filterApartmentId = '';

  protected readonly dashboardLink = computed(() => {
    const id = this.tenant.activeCondominiumId();
    return id ? `/app/condominiums/${id}` : '/app';
  });

  ngOnInit(): void {
    const condoId = this.tenant.activeCondominiumId()!;
    // Condomínios com >100 unidades precisam paginar aqui também (pendência conhecida).
    this.apartmentsApi.list(condoId, 0, 100).subscribe({
      next: (page) => this.apartments.set([...page.content]),
    });
    this.loadInvitations();
  }

  private loadInvitations(): void {
    const condoId = this.tenant.activeCondominiumId()!;
    const filters: { apartmentId?: string; status?: InvitationStatus } = {};
    if (this.filterApartmentId) filters.apartmentId = this.filterApartmentId;
    if (this.filterStatus) filters.status = this.filterStatus as InvitationStatus;

    this.api.list(condoId, filters).subscribe({
      next: (data) => {
        this.invitations.set(data);
        this.pageState.set('ready');
      },
      error: (e: unknown) => {
        this.errorMessage.set(e instanceof Error ? e.message : 'Erro ao carregar convites.');
        this.pageState.set('error');
      },
    });
  }

  protected onFilterChange(): void {
    this.loadInvitations();
  }

  protected navigateToBulk(): void {
    const condoId = this.tenant.activeCondominiumId();
    void this.router.navigate(['/app/condominiums', condoId, 'invitations', 'bulk']);
  }

  protected onCreate(req: CreateInvitationRequest): void {
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) return;
    this.api.create(condoId, req).subscribe({
      next: (created) => {
        this.showForm.set(false);
        this.invitations.update((list) => [created, ...list]);
      },
      error: (err: unknown) => {
        const msg =
          err instanceof HttpErrorResponse && typeof err.error?.message === 'string'
            ? err.error.message
            : 'Erro ao criar convite. Verifique se já existe convite pendente para este apartamento e e-mail.';
        this.form?.setError(msg);
      },
    });
  }

  protected onResend(id: string): void {
    this.api.resend(id).subscribe({
      next: (updated) => {
        this.invitations.update((list) =>
          list.map((inv) => (inv.id === id ? { ...inv, status: 'REVOKED' as const } : inv)),
        );
        this.invitations.update((list) => [updated, ...list]);
      },
    });
  }

  protected onRevoke(id: string): void {
    this.api.revoke(id).subscribe({
      next: () => {
        this.invitations.update((list) =>
          list.map((inv) => (inv.id === id ? { ...inv, status: 'REVOKED' as const } : inv)),
        );
      },
      error: () => {
        this.errorMessage.set('Erro ao revogar convite. Tente novamente.');
        this.pageState.set('error');
      },
    });
  }

  protected onFixEmail(event: { id: string; newEmail: string }): void {
    this.api.fixEmail(event.id, { newEmail: event.newEmail }).subscribe({
      next: (updated) => {
        this.invitations.update((list) =>
          list.map((inv) => (inv.id === event.id ? { ...inv, status: 'REVOKED' as const } : inv)),
        );
        this.invitations.update((list) => [updated, ...list]);
      },
    });
  }
}
