import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { SuccessPopup } from './success-popup';

@Component({
  standalone: true,
  imports: [SuccessPopup],
  template: `
    <app-success-popup
      [open]="open()"
      [voteCount]="voteCount()"
      [durationMs]="durationMs()"
      (closed)="closedCount = closedCount + 1"
    />
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly voteCount = signal(1);
  readonly durationMs = signal(2500);
  closedCount = 0;
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

describe('SuccessPopup', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('não renderiza quando open=false', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renderiza singular quando voteCount=1', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Voto computado com sucesso!');
  });

  it('renderiza plural quando voteCount=3', async () => {
    const { fixture, host } = await setup();
    host.voteCount.set(3);
    host.open.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('3 votos computados com sucesso!');
  });

  describe('timer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('emite closed após durationMs', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      vi.advanceTimersByTime(2500);

      expect(host.closedCount).toBe(1);
    });

    it('não emite quando open permanece false', async () => {
      const { host } = await setup();

      vi.advanceTimersByTime(5000);

      expect(host.closedCount).toBe(0);
    });

    it('cleanup do timer ao destruir componente não provoca emissão', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      fixture.destroy();
      vi.advanceTimersByTime(5000);

      expect(host.closedCount).toBe(0);
    });
  });
});
