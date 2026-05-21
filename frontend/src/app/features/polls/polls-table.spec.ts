import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach } from 'vitest';
import { PollResponse } from '../../core/api/polls-api.service';
import { PollsTable } from './polls-table';

@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [PollsTable],
  template: `
    <app-polls-table
      [polls]="polls()"
      [page]="page()"
      [size]="size()"
      [totalElements]="totalElements()"
      [totalPages]="totalPages()"
      [emptyMessage]="emptyMessage"
      (pageChange)="lastPage = $event"
      (sizeChange)="lastSize = $event"
    />
  `,
})
class HostComponent {
  readonly polls = signal<ReadonlyArray<PollResponse>>([]);
  readonly page = signal(0);
  readonly size = signal(10);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  emptyMessage = 'Nenhuma votação encontrada.';
  lastPage: number | null = null;
  lastSize: number | null = null;
}

function makePoll(overrides: Partial<PollResponse> = {}): PollResponse {
  return {
    id: 'poll-1',
    condominiumId: 'condo-1',
    title: 'Votação X',
    description: null,
    convocation: 'FIRST',
    quorumMode: 'SIMPLE_MAJORITY',
    status: 'OPEN',
    scheduledStart: '2026-06-01T10:00:00Z',
    scheduledEnd: '2026-06-01T18:00:00Z',
    openedAt: null,
    eligibleCount: null,
    closedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

async function setup(initial: Partial<HostComponent> = {}) {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  const host = fixture.componentInstance;
  if (initial.polls) host.polls.set(initial.polls as ReadonlyArray<PollResponse>);
  if (initial.page !== undefined) host.page.set(initial.page);
  if (initial.totalElements !== undefined) host.totalElements.set(initial.totalElements);
  if (initial.totalPages !== undefined) host.totalPages.set(initial.totalPages);
  if (initial.emptyMessage) host.emptyMessage = initial.emptyMessage;
  fixture.detectChanges();
  return { fixture, host };
}

describe('PollsTable', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('totalElements=0: exibe emptyMessage e não renderiza tabela nem paginator', async () => {
    const { fixture } = await setup({
      polls: [],
      totalElements: 0,
      emptyMessage: 'Nenhuma votação em andamento.',
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Nenhuma votação em andamento.');
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('app-paginator')).toBeNull();
  });

  it('com polls: renderiza 1 linha por poll com título, status, convocação, quórum', async () => {
    const { fixture } = await setup({
      polls: [
        makePoll({ id: 'p1', title: 'Reforma', convocation: 'FIRST', quorumMode: 'QUALIFIED_2_3' }),
        makePoll({ id: 'p2', title: 'Eleição', convocation: 'SECOND', quorumMode: 'ABSOLUTE_MAJORITY' }),
      ],
      totalElements: 2,
      totalPages: 1,
    });
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Reforma');
    expect(rows[0].textContent).toContain('1ª Convocação');
    expect(rows[0].textContent).toContain('Qualificado 2/3');
    expect(rows[1].textContent).toContain('Eleição');
    expect(rows[1].textContent).toContain('2ª Convocação');
    expect(rows[1].textContent).toContain('Maioria Absoluta');
  });

  it('título de cada poll é link para ./:id', async () => {
    const { fixture } = await setup({
      polls: [makePoll({ id: 'p-abc' })],
      totalElements: 1,
      totalPages: 1,
    });
    const link = fixture.nativeElement.querySelector('tbody a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('p-abc');
  });

  it('quorum/convocation desconhecidos caem no valor cru', async () => {
    const { fixture } = await setup({
      polls: [
        makePoll({
          convocation: 'UNKNOWN' as unknown as PollResponse['convocation'],
          quorumMode: 'WEIRD' as unknown as PollResponse['quorumMode'],
        }),
      ],
      totalElements: 1,
      totalPages: 1,
    });
    const row = fixture.nativeElement.querySelector('tbody tr');
    expect(row?.textContent).toContain('UNKNOWN');
    expect(row?.textContent).toContain('WEIRD');
  });

  it('paginator emite pageChange e sizeChange para o host', async () => {
    const { fixture, host } = await setup({
      polls: [makePoll()],
      totalElements: 30,
      totalPages: 3,
    });
    // O Paginator é renderizado quando totalElements > 0; simulamos clique direto.
    const nextBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLButtonElement).textContent?.includes('Próxima'),
    ) as HTMLButtonElement | undefined;
    nextBtn?.click();
    fixture.detectChanges();
    expect(host.lastPage).toBe(1);
  });

  it('formatDate: null vira "—"', async () => {
    const { fixture } = await setup({
      polls: [makePoll({ scheduledStart: null as unknown as string, scheduledEnd: null as unknown as string })],
      totalElements: 1,
      totalPages: 1,
    });
    const cells = fixture.nativeElement.querySelectorAll('tbody td');
    expect(cells[cells.length - 1].textContent?.trim()).toBe('—');
  });
});
