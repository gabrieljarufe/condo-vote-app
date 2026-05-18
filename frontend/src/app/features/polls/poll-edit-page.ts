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
import {
  CreatePollRequest,
  PollDetailResponse,
  PollsApiService,
} from '../../core/api/polls-api.service';
import { AppHeader } from '../../shared/layout/app-header';
import { Spinner } from '../../shared/ui/spinner';
import { PollForm, PollFormValue } from './poll-form';

type PageState = 'loading' | 'blocked' | 'ready' | 'error';

const EDITABLE_STATUSES = new Set(['DRAFT', 'SCHEDULED']);

/**
 * Converte uma string ISO 8601 UTC em formato datetime-local (yyyy-MM-ddTHH:mm)
 * usando a hora local do browser — necessário para preencher inputs do tipo datetime-local.
 *
 * Exemplo: "2026-05-17T22:00:00Z" no fuso America/Sao_Paulo → "2026-05-17T19:00"
 */
export function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-poll-edit-page',
  imports: [AppHeader, RouterLink, PollForm, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-app-header />

    <main class="max-w-2xl mx-auto px-6 py-12">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-8">
        <a
          [routerLink]="detailLink()"
          class="text-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Votação
        </a>
        <span class="text-on-surface-variant">/</span>
        <h1 class="text-2xl font-semibold text-on-surface">Editar votação</h1>
      </div>

      @if (pageState() === 'loading') {
        <div class="flex justify-center py-12">
          <app-spinner label="Carregando votação…" />
        </div>
      } @else if (pageState() === 'error') {
        <p class="text-sm text-error py-4" role="alert">{{ errorMessage() }}</p>
      } @else if (pageState() === 'blocked') {
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
          <p class="text-sm text-on-surface-variant mb-4">
            Não é possível editar votação no estado <strong>{{ blockedStatus() }}</strong>.
          </p>
          <a
            [routerLink]="detailLink()"
            class="px-4 py-2 text-sm rounded-lg border border-outline-variant hover:bg-surface-container"
          >
            ← Voltar
          </a>
        </div>
      } @else {
        <section class="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6">
          <app-poll-form
            #pollForm
            [initialValue]="initialValue()"
            submitLabel="Salvar alterações"
            (submit)="onSubmit($event)"
            (cancel)="onCancel()"
          />
        </section>
      }
    </main>
  `,
})
export default class PollEditPage implements OnInit {
  @ViewChild('pollForm') private pollForm?: PollForm;

  private readonly pollsApi = inject(PollsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly errorMessage = signal('');
  protected readonly blockedStatus = signal('');
  protected readonly initialValue = signal<PollFormValue | null>(null);
  protected readonly detailLink = signal('');

  private condoId = '';
  private pollId = '';

  ngOnInit(): void {
    this.condoId = this.route.snapshot.params['condoId'] as string;
    this.pollId = this.route.snapshot.params['pollId'] as string;
    this.detailLink.set(`/app/condominiums/${this.condoId}/polls/${this.pollId}`);
    this.loadPoll();
  }

  private loadPoll(): void {
    this.pageState.set('loading');
    this.pollsApi.getById(this.pollId).subscribe({
      next: (detail: PollDetailResponse) => {
        const { poll, options } = detail;
        if (!EDITABLE_STATUSES.has(poll.status)) {
          this.blockedStatus.set(poll.status);
          this.pageState.set('blocked');
          return;
        }
        this.initialValue.set({
          title: poll.title,
          description: poll.description ?? '',
          convocation: poll.convocation,
          quorumMode: poll.quorumMode,
            scheduledStart: toLocalDatetimeInput(poll.scheduledStart),
          scheduledEnd: toLocalDatetimeInput(poll.scheduledEnd),
          options: options.map((o) => o.label),
        });
        this.pageState.set('ready');
      },
      error: (e: unknown) => {
        const message =
          e instanceof HttpErrorResponse
            ? (e.error?.message as string | undefined) ?? e.message
            : 'Erro ao carregar votação.';
        this.errorMessage.set(message);
        this.pageState.set('error');
      },
    });
  }

  protected onSubmit(request: CreatePollRequest): void {
    this.pollsApi.update(this.pollId, request).subscribe({
      next: () => {
        void this.router.navigate([this.detailLink()]);
      },
      error: (e: unknown) => {
        const message =
          e instanceof HttpErrorResponse
            ? (e.error?.message as string | undefined) ?? e.message
            : 'Erro ao salvar votação.';
        this.pollForm?.setError(message);
      },
    });
  }

  protected onCancel(): void {
    void this.router.navigate([this.detailLink()]);
  }
}
