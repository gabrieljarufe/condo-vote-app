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

const EXIT_MS = 280;

describe('SuccessPopup', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('não renderiza quando open=false', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('renderiza singular quando voteCount=1', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Voto computado com sucesso!');
  });

  it('renderiza plural quando voteCount=3', async () => {
    const { fixture, host } = await setup();
    host.voteCount.set(3);
    host.open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 votos computados com sucesso!');
  });

  it('tem role="alertdialog" quando open=true', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('não renderiza botão (auto-dismiss only)', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  describe('timer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('emite closed após durationMs default (2500) + animação de saída', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      vi.advanceTimersByTime(2500);
      expect(host.closedCount).toBe(0); // ainda em animação
      vi.advanceTimersByTime(EXIT_MS);
      expect(host.closedCount).toBe(1);
    });

    it('emite closed após durationMs customizado + animação', async () => {
      const { fixture, host } = await setup();
      host.durationMs.set(3000);
      host.open.set(true);
      fixture.detectChanges();

      vi.advanceTimersByTime(3000 + EXIT_MS - 1);
      expect(host.closedCount).toBe(0);
      vi.advanceTimersByTime(1);
      expect(host.closedCount).toBe(1);
    });

    it('Esc inicia fechamento e emite após animação', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(host.closedCount).toBe(0);
      vi.advanceTimersByTime(EXIT_MS);
      expect(host.closedCount).toBe(1);
    });

    it('aplica classe .closing no backdrop quando inicia saída', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      const backdrop = fixture.nativeElement.querySelector('[data-popup-backdrop]');
      expect(backdrop.classList.contains('closing')).toBe(true);
    });

    it('não emite quando open permanece false', async () => {
      const { host } = await setup();
      vi.advanceTimersByTime(10000);
      expect(host.closedCount).toBe(0);
    });

    it('cleanup do timer ao destruir componente não provoca emissão', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      fixture.destroy();
      vi.advanceTimersByTime(10000);
      expect(host.closedCount).toBe(0);
    });

    it('Esc múltiplos não duplicam emissão', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      vi.advanceTimersByTime(EXIT_MS);
      expect(host.closedCount).toBe(1);
    });
  });

  describe('prefers-reduced-motion', () => {
    it('container renderiza sem crash (CSS @media trata a redução)', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
    });
  });
});
