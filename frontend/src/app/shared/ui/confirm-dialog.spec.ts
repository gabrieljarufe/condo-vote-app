import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Componente host auxiliar para testar o ConfirmDialog em cenário realista.
 */
@Component({
  standalone: true,
  imports: [ConfirmDialog],
  template: `
    <app-confirm-dialog
      [open]="open()"
      [title]="title()"
      [body]="body()"
      [confirmLabel]="confirmLabel()"
      [cancelLabel]="cancelLabel()"
      [variant]="variant()"
      [requireExplicitConsent]="requireExplicitConsent()"
      (confirmed)="confirmedCount = confirmedCount + 1"
      (cancelled)="cancelledCount = cancelledCount + 1"
    />
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly title = signal('Confirmar ação?');
  readonly body = signal('Esta ação será executada.');
  readonly confirmLabel = signal('Confirmar');
  readonly cancelLabel = signal('Cancelar');
  readonly variant = signal<'default' | 'danger'>('default');
  readonly requireExplicitConsent = signal(false);

  confirmedCount = 0;
  cancelledCount = 0;
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

describe('ConfirmDialog', () => {
  afterEach(() => TestBed.resetTestingModule());

  // ── Render ─────────────────────────────────────────────────────────────────

  it('não renderiza quando open=false', async () => {
    const { fixture } = await setup();
    const alertdialog = fixture.nativeElement.querySelector('[role="alertdialog"]');
    expect(alertdialog).toBeNull();
  });

  it('renderiza título e corpo quando open=true', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Confirmar ação?');
    expect(text).toContain('Esta ação será executada.');
  });

  it('renderiza rótulos customizados nos botões', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    host.confirmLabel.set('Excluir');
    host.cancelLabel.set('Voltar');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Excluir');
    expect(text).toContain('Voltar');
  });

  // ── Emissão de eventos ─────────────────────────────────────────────────────

  it('clique em confirmar emite (confirmed)', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    // Botão confirm é o segundo (cancel é primeiro no DOM, recebe foco APG)
    const confirmBtn = buttons[1].nativeElement as HTMLButtonElement;
    confirmBtn.click();
    fixture.detectChanges();

    expect(host.confirmedCount).toBe(1);
    expect(host.cancelledCount).toBe(0);
  });

  it('clique em cancelar emite (cancelled)', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const cancelBtn = buttons[0].nativeElement as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();

    expect(host.cancelledCount).toBe(1);
    expect(host.confirmedCount).toBe(0);
  });

  it('Esc dispara (cancelled) via Dialog', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(host.cancelledCount).toBe(1);
    expect(host.confirmedCount).toBe(0);
  });

  // ── Variant danger ─────────────────────────────────────────────────────────

  it('variant=danger aplica classe bg-error no botão de confirmação', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    host.variant.set('danger');
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const confirmBtn = buttons[1].nativeElement as HTMLButtonElement;
    expect(confirmBtn.className).toContain('bg-error');
  });

  it('variant=default aplica classe bg-primary no botão de confirmação', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    host.variant.set('default');
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const confirmBtn = buttons[1].nativeElement as HTMLButtonElement;
    expect(confirmBtn.className).toContain('bg-primary');
    expect(confirmBtn.className).not.toContain('bg-error');
  });

  // ── Foco inicial (APG alertdialog) ────────────────────────────────────────

  it('foco inicial vai ao botão Cancelar (secundário), não ao Confirmar', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    await flushMicrotasks();

    // O botão cancelar tem id fixo 'confirm-dialog-cancel'
    const focused = document.activeElement as HTMLElement;
    expect(focused?.id).toBe('confirm-dialog-cancel');
  });

  // ── requireExplicitConsent ────────────────────────────────────────────────

  it('requireExplicitConsent=true bloqueia confirmar até checkbox ser marcado', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    host.requireExplicitConsent.set(true);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const confirmBtn = buttons[1].nativeElement as HTMLButtonElement;

    // Antes de marcar o checkbox: botão deve estar desabilitado
    expect(confirmBtn.disabled).toBe(true);
    expect(host.confirmedCount).toBe(0);

    // Marca o checkbox
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();

    // Após marcar: botão habilitado e clique funciona
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();
    fixture.detectChanges();
    expect(host.confirmedCount).toBe(1);
  });

  it('requireExplicitConsent=false não exibe checkbox', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    host.requireExplicitConsent.set(false);
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeNull();
  });

  it('consentimento é resetado ao fechar e reabrir o dialog', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    host.requireExplicitConsent.set(true);
    fixture.detectChanges();

    // Marca o checkbox
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();

    // Fecha o dialog
    host.open.set(false);
    fixture.detectChanges();

    // Reabre
    host.open.set(true);
    fixture.detectChanges();

    // Botão deve estar desabilitado novamente (consentimento resetado)
    const buttons = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const confirmBtn = buttons[1].nativeElement as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  // ── Acessibilidade ────────────────────────────────────────────────────────

  it('título tem role=alertdialog (não dialog comum)', async () => {
    const { fixture, host } = await setup();
    host.open.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('[role="alertdialog"]');
    expect(el).not.toBeNull();
  });
});
