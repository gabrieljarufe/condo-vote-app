import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { Dialog } from './dialog';

@Component({
  standalone: true,
  imports: [Dialog],
  template: `
    <app-dialog
      [open]="open()"
      [closeOnEsc]="closeOnEsc()"
      [closeOnBackdrop]="closeOnBackdrop()"
      [ariaLabelledBy]="labelledBy()"
      (closed)="closedCount = closedCount + 1"
    >
      <h2 id="t-title" dialog-title>Título</h2>
      <p dialog-body>Corpo</p>
      <div dialog-actions>
        <button id="first-btn">Primeiro</button>
        <button id="second-btn">Segundo</button>
      </div>
    </app-dialog>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly closeOnEsc = signal(true);
  readonly closeOnBackdrop = signal(true);
  readonly labelledBy = signal<string | null>('t-title');
  closedCount = 0;
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => queueMicrotask(() => r()));
}

describe('Dialog', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('não renderiza quando open=false', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renderiza com role, aria-modal e aria-labelledby quando open=true', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const dialogEl = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogEl).toBeTruthy();
    expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    expect(dialogEl.getAttribute('aria-labelledby')).toBe('t-title');
  });

  it('ESC emite closed quando closeOnEsc=true', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closedCount).toBe(1);
  });

  it('ESC não emite quando closeOnEsc=false', async () => {
    const { fixture, host } = await setup();
    host.closeOnEsc.set(false);
    host.open.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closedCount).toBe(0);
  });

  it('click no backdrop emite closed', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const backdrop = fixture.nativeElement.querySelector('[data-dialog-backdrop]') as HTMLElement;
    backdrop.click();
    expect(host.closedCount).toBe(1);
  });

  it('click no container não emite closed', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const container = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    container.click();
    expect(host.closedCount).toBe(0);
  });

  it('click no backdrop não emite quando closeOnBackdrop=false', async () => {
    const { fixture, host } = await setup();
    host.closeOnBackdrop.set(false);
    host.open.set(true);
    fixture.detectChanges();
    const backdrop = fixture.nativeElement.querySelector('[data-dialog-backdrop]') as HTMLElement;
    backdrop.click();
    expect(host.closedCount).toBe(0);
  });

  it('foco inicial vai para o primeiro elemento focável dentro', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    await flushMicrotasks();
    expect(document.activeElement?.id).toBe('first-btn');
  });
});
