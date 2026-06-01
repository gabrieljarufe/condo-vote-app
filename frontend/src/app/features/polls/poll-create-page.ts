import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { CreatePollRequest, PollsApiService } from '../../core/api/polls-api.service';
import { AppHeader } from '../../shared/layout/app-header';
import { PollForm } from './poll-form';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { SuccessPopup } from '../../shared/ui/success-popup';

@Component({
  selector: 'app-poll-create-page',
  imports: [AppHeader, RouterLink, PollForm, ConfirmDialog, SuccessPopup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-2xl mx-auto px-6 py-12">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-8">
        <a
          [routerLink]="pollsLink()"
          class="text-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Votações
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Nova votação</h1>
      </div>

      <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
        <app-poll-form
          #pollForm
          submitLabel="Criar rascunho"
          (submitted)="onSubmit($event)"
          (cancel)="onCancel()"
        />
      </section>
    </main>

    <app-confirm-dialog
      [open]="publishDialogOpen()"
      title="Publicar esta votação agora?"
      body="Ao publicar, a votação fica agendada para o período definido e será visível para os moradores no horário de início. Você ainda pode cancelá-la antes da abertura."
      confirmLabel="Publicar agora"
      cancelLabel="Manter como rascunho"
      (confirmed)="onPublishConfirm()"
      (cancelled)="onPublishCancel()"
    />

    <app-success-popup
      [open]="showSuccessPopup()"
      message="Votação publicada com sucesso!"
      (closed)="onSuccessPopupClosed()"
    />
  `,
})
export default class PollCreatePage implements OnInit {
  @ViewChild('pollForm') private pollForm?: PollForm;

  private readonly pollsApi = inject(PollsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pollsLink = signal('');
  protected readonly publishDialogOpen = signal(false);
  protected readonly publishing = signal(false);
  protected readonly showSuccessPopup = signal(false);
  private createdPollId: string | null = null;

  private condoId = '';

  ngOnInit(): void {
    this.condoId = this.route.snapshot.params['condoId'] as string;
    this.pollsLink.set(`/app/condominiums/${this.condoId}/polls`);
  }

  protected onSubmit(request: CreatePollRequest): void {
    this.pollsApi
      .create(this.condoId, request)
      .pipe(finalize(() => this.pollForm?.clearSubmitting()))
      .subscribe({
        next: (response) => {
          this.createdPollId = response.id;
          this.publishDialogOpen.set(true);
        },
        error: (e: unknown) => {
          const message =
            e instanceof HttpErrorResponse
              ? (e.error?.message as string | undefined) ?? e.message
              : 'Erro ao criar votação.';
          this.pollForm?.setError(message);
        },
      });
  }

  protected onPublishConfirm(): void {
    const id = this.createdPollId;
    if (id === null || this.publishing()) return;
    this.publishing.set(true);
    this.pollsApi
      .publish(id)
      .pipe(finalize(() => this.publishing.set(false)))
      .subscribe({
        next: () => {
          // Fecha o confirm e dispara o SuccessPopup; a navegação só acontece
          // depois que o popup fechar (handler onSuccessPopupClosed).
          this.publishDialogOpen.set(false);
          this.showSuccessPopup.set(true);
        },
        error: () => {
          // Poll foi criado; só a publicação falhou. Navegamos direto para o
          // detail (sem popup de sucesso) onde o síndico pode revisar datas e
          // tentar publicar manualmente.
          this.publishDialogOpen.set(false);
          this.goToDetail(id);
        },
      });
  }

  protected onPublishCancel(): void {
    const id = this.createdPollId;
    this.publishDialogOpen.set(false);
    if (id !== null) this.goToDetail(id);
  }

  protected onSuccessPopupClosed(): void {
    this.showSuccessPopup.set(false);
    if (this.createdPollId !== null) this.goToDetail(this.createdPollId);
  }

  private goToDetail(pollId: string): void {
    void this.router.navigate([`/app/condominiums/${this.condoId}/polls`, pollId]);
  }

  protected onCancel(): void {
    void this.router.navigate([this.pollsLink()]);
  }
}
