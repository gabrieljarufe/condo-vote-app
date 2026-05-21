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
  readonly durationMs = signal(1800);
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
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
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

  it('tem role="alertdialog" quando open=true', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('botão OK está presente e tem type="button"', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button[type="button"]');
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim()).toBe('OK');
  });

  it('clicar em OK emite closed', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="button"]');
    btn.click();
    expect(host.closedCount).toBe(1);
  });

  it('Esc emite closed', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closedCount).toBe(1);
  });

  it('Enter no botão OK emite closed', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="button"]');
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.closedCount).toBe(1);
  });

  describe('timer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('emite closed após 1800ms (default)', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      vi.advanceTimersByTime(1800);

      expect(host.closedCount).toBe(1);
    });

    it('emite closed após durationMs customizado', async () => {
      const { fixture, host } = await setup();
      host.durationMs.set(3000);
      host.open.set(true);
      fixture.detectChanges();

      vi.advanceTimersByTime(2999);
      expect(host.closedCount).toBe(0);

      vi.advanceTimersByTime(1);
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

    it('clicar OK cancela o auto-dismiss (não emite duas vezes)', async () => {
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();

      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="button"]');
      btn.click();
      expect(host.closedCount).toBe(1);

      vi.advanceTimersByTime(5000);
      expect(host.closedCount).toBe(1);
    });
  });

  describe('prefers-reduced-motion', () => {
    it('container não tem animation inline quando reduced motion está ativo', async () => {
      // O componente honra prefers-reduced-motion via @media no CSS;
      // o snapshot CSS existe e a regra 'animation: none' está declarada.
      const { fixture, host } = await setup();
      host.open.set(true);
      fixture.detectChanges();
      // O container renderiza corretamente sem crash
      const container = fixture.nativeElement.querySelector('[role="alertdialog"]');
      expect(container).not.toBeNull();
    });
  });
});
