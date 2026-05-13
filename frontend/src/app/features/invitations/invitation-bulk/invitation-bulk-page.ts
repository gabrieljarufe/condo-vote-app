import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Apartment } from '../../../core/api/apartments-api.service';
import { ApartmentsApiService } from '../../../core/api/apartments-api.service';
import {
  BulkInvitationEntry,
  BulkRowError,
  InvitationsApiService,
} from '../../../core/api/invitations-api.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { AppHeader } from '../../../shared/layout/app-header';
import { InvitationBulkPreviewGrid } from './invitation-bulk-preview-grid';
import { InvitationBulkUploadForm, ParsedRow } from './invitation-bulk-upload-form';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-invitation-bulk-page',
  imports: [AppHeader, RouterLink, InvitationBulkUploadForm, InvitationBulkPreviewGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-4xl mx-auto px-6 py-12">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-8">
        <a
          [routerLink]="invitationsLink()"
          class="text-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Convites
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Importar planilha</h1>
      </div>

      <!-- Step 1: Upload -->
      @if (step() === 'upload') {
        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4">Passo 1 de 2 — Upload</h2>
          <app-invitation-bulk-upload-form
            (parsed)="onParsed($event)"
            (cancel)="navigateToInvitations()"
          />
        </section>
      }

      <!-- Step 2: Preview -->
      @if (step() === 'preview') {

        <!-- Banner de sucesso -->
        @if (submitStatus() === 'success') {
          <div
            class="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between gap-4"
            role="status"
          >
            <p class="text-sm font-medium text-green-700">
              Convites enviados com sucesso! Redirecionando…
            </p>
          </div>
        }

        <!-- Banner de erro do backend -->
        @if (submitStatus() === 'error' && submitError()) {
          <div
            class="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3"
            role="alert"
          >
            <p class="text-sm font-medium text-error">{{ submitError() }}</p>
          </div>
        }

        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4">Passo 2 de 2 — Revisar convites</h2>
          <app-invitation-bulk-preview-grid
            [rows]="parsedRows()"
            [apartments]="apartments()"
            [disabled]="submitStatus() === 'loading'"
            (back)="step.set('upload')"
            (cancel)="navigateToInvitations()"
            (submitBatch)="onSubmit($event)"
          />
        </section>
      }
    </main>
  `,
})
export default class InvitationBulkPage implements OnInit {
  private readonly api = inject(InvitationsApiService);
  private readonly apartmentsApi = inject(ApartmentsApiService);
  protected readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  protected readonly step = signal<'upload' | 'preview'>('upload');
  protected readonly parsedRows = signal<ParsedRow[]>([]);
  protected readonly apartments = signal<readonly Apartment[]>([]);
  protected readonly submitStatus = signal<SubmitStatus>('idle');
  protected readonly submitError = signal('');

  protected readonly invitationsLink = computed(() => {
    const id = this.tenant.activeCondominiumId();
    return id ? `/app/condominiums/${id}/invitations` : '/app';
  });

  ngOnInit(): void {
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) return;

    this.apartmentsApi.list(condoId).subscribe({
      next: (apts) => this.apartments.set(apts),
      error: () => {
        // Non-fatal: preview grid will show "not found" for all apts
      },
    });
  }

  protected onParsed(rows: ParsedRow[]): void {
    this.parsedRows.set(rows);
    this.step.set('preview');
    this.submitStatus.set('idle');
    this.submitError.set('');
  }

  protected onSubmit(entries: BulkInvitationEntry[]): void {
    const condoId = this.tenant.activeCondominiumId();
    if (!condoId) return;

    this.submitStatus.set('loading');
    this.submitError.set('');

    this.api.createBulk(condoId, { entries }).subscribe({
      next: (result) => {
        if (result.errors.length === 0) {
          this.submitStatus.set('success');
          setTimeout(() => this.navigateToInvitations(), 1500);
        } else {
          this.applyBackendErrors(result.errors);
          this.submitStatus.set('error');
          this.submitError.set(
            `${result.errors.length} linha(s) com erro retornadas pelo servidor. Corrija e tente novamente.`,
          );
        }
      },
      error: (e: unknown) => {
        this.submitStatus.set('error');
        this.submitError.set(
          e instanceof Error ? e.message : 'Erro ao criar convites. Tente novamente.',
        );
      },
    });
  }

  private applyBackendErrors(backendErrors: ReadonlyArray<BulkRowError>): void {
    this.parsedRows.update((rows) => {
      const updated = rows.map((row) => ({ ...row, errors: [] as string[] }));
      for (const err of backendErrors) {
        const target = updated.find((r) => r.rowIndex === err.rowIndex);
        if (target) {
          target.errors.push(err.message);
        }
      }
      return updated;
    });
  }

  protected navigateToInvitations(): void {
    const condoId = this.tenant.activeCondominiumId();
    void this.router.navigate(['/app/condominiums', condoId, 'invitations']);
  }
}
