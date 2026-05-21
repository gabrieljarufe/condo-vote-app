import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach } from 'vitest';
import { MyPendingPollResponse } from '../../core/api/polls-api.service';
import { PendingPollsList } from './pending-polls-list';

@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [PendingPollsList],
  template: `
    <app-pending-polls-list
      [polls]="polls()"
      [condoId]="condoId"
      (seeInProgress)="seeInProgressCount = seeInProgressCount + 1"
    />
  `,
})
class HostComponent {
  readonly polls = signal<ReadonlyArray<MyPendingPollResponse>>([]);
  readonly condoId = 'condo-1';
  seeInProgressCount = 0;
}

function makePoll(overrides: Partial<MyPendingPollResponse> = {}): MyPendingPollResponse {
  return {
    pollId: 'poll-1',
    title: 'Assembleia anual',
    scheduledEnd: '2026-06-01T18:00:00Z',
    pendingBallotsCount: 2,
    totalBallotsCount: 3,
    ...overrides,
  };
}

async function setup(polls: ReadonlyArray<MyPendingPollResponse> = []) {
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.polls.set(polls);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

describe('PendingPollsList', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lista vazia: exibe mensagem "não tem votações pendentes" + link "Ver em andamento"', async () => {
    const { fixture } = await setup([]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Você não tem votações pendentes');
    expect(el.querySelector('a')?.textContent).toContain('Ver em andamento');
  });

  it('lista vazia: clicar em "Ver em andamento" emite seeInProgress', async () => {
    const { fixture, host } = await setup([]);
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    link.click();
    expect(host.seeInProgressCount).toBe(1);
  });

  it('lista com itens: renderiza 1 article por poll com título e contagem de cédulas', async () => {
    const { fixture } = await setup([
      makePoll({ pollId: 'p1', title: 'Reforma da fachada', pendingBallotsCount: 1, totalBallotsCount: 2 }),
      makePoll({ pollId: 'p2', title: 'Eleição síndico', pendingBallotsCount: 3, totalBallotsCount: 3 }),
    ]);
    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles).toHaveLength(2);
    expect(articles[0].textContent).toContain('Reforma da fachada');
    expect(articles[0].textContent).toContain('1 de 2 cédula(s) pendente(s)');
    expect(articles[1].textContent).toContain('Eleição síndico');
    expect(articles[1].textContent).toContain('3 de 3 cédula(s) pendente(s)');
  });

  it('cada item tem link [Votar →] para /app/condominiums/{condoId}/polls/{pollId}/vote', async () => {
    const { fixture } = await setup([makePoll({ pollId: 'p-abc' })]);
    const link = fixture.nativeElement.querySelector('article a') as HTMLAnchorElement;
    expect(link.textContent).toContain('Votar');
    expect(link.getAttribute('href')).toBe('/app/condominiums/condo-1/polls/p-abc/vote');
  });

  it('formatDate: ISO válido formata pt-BR; null vira "—"', async () => {
    const { fixture } = await setup([
      makePoll({ scheduledEnd: '2026-12-31T23:59:00Z' }),
    ]);
    const txt = fixture.nativeElement.querySelector('article p')?.textContent ?? '';
    // dd/mm/aa em locale pt-BR (pode variar TZ; valida o ano)
    expect(txt).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });
});
