import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Paginator } from './paginator';

@Component({
  selector: 'test-host',
  standalone: true,
  imports: [Paginator],
  template: `
    <app-paginator
      [page]="page()"
      [size]="size()"
      [totalElements]="totalElements()"
      [totalPages]="totalPages()"
      (pageChange)="lastPage = $event"
      (sizeChange)="lastSize = $event"
    />
  `,
})
class HostComponent {
  readonly page = signal(0);
  readonly size = signal(20);
  readonly totalElements = signal(100);
  readonly totalPages = signal(5);
  lastPage: number | null = null;
  lastSize: number | null = null;
}

async function setup(initial: Partial<{ page: number; size: number; totalElements: number; totalPages: number }> = {}) {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  const host = fixture.componentInstance;
  if (initial.page !== undefined) host.page.set(initial.page);
  if (initial.size !== undefined) host.size.set(initial.size);
  if (initial.totalElements !== undefined) host.totalElements.set(initial.totalElements);
  if (initial.totalPages !== undefined) host.totalPages.set(initial.totalPages);
  fixture.detectChanges();
  return { fixture, host };
}

function findButton(fixture: { nativeElement: HTMLElement }, text: string): HTMLButtonElement {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
  return buttons.find((b) => b.textContent?.includes(text))!;
}

describe('Paginator', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('desabilita "Anterior" na primeira página', async () => {
    const { fixture } = await setup({ page: 0, totalPages: 5 });
    expect(findButton(fixture, 'Anterior').disabled).toBe(true);
    expect(findButton(fixture, 'Próxima').disabled).toBe(false);
  });

  it('desabilita "Próxima" na última página', async () => {
    const { fixture } = await setup({ page: 4, totalPages: 5 });
    expect(findButton(fixture, 'Anterior').disabled).toBe(false);
    expect(findButton(fixture, 'Próxima').disabled).toBe(true);
  });

  it('clicar "Próxima" emite pageChange com page+1', async () => {
    const { fixture, host } = await setup({ page: 1, totalPages: 5 });
    findButton(fixture, 'Próxima').click();
    expect(host.lastPage).toBe(2);
  });

  it('clicar "Anterior" emite pageChange com page-1', async () => {
    const { fixture, host } = await setup({ page: 3, totalPages: 5 });
    findButton(fixture, 'Anterior').click();
    expect(host.lastPage).toBe(2);
  });

  it('alterar select emite sizeChange', async () => {
    const { fixture, host } = await setup({ size: 20, totalPages: 5 });
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(host.lastSize).toBe(50);
  });

  it('renderiza "Página X de Y" e totalElements', async () => {
    const { fixture } = await setup({ page: 1, size: 10, totalElements: 25, totalPages: 3 });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Página 2 de 3');
    expect(text).toContain('25 unidades');
  });
});
