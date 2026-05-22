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

@Component({
  selector: 'app-poll-create-page',
  imports: [AppHeader, RouterLink, PollForm],
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
          (submit)="onSubmit($event)"
          (cancel)="onCancel()"
        />
      </section>
    </main>
  `,
})
export default class PollCreatePage implements OnInit {
  @ViewChild('pollForm') private pollForm?: PollForm;

  private readonly pollsApi = inject(PollsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pollsLink = signal('');

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
          void this.router.navigate([`/app/condominiums/${this.condoId}/polls`, response.id]);
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

  protected onCancel(): void {
    void this.router.navigate([this.pollsLink()]);
  }
}
