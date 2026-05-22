import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { PollCancelDialog } from './poll-cancel-dialog';
import { By } from '@angular/platform-browser';

async function setup(open = false) {
  await TestBed.configureTestingModule({
    imports: [PollCancelDialog],
  }).compileComponents();
  const fixture = TestBed.createComponent(PollCancelDialog);
  fixture.componentInstance.open = open;
  fixture.detectChanges();
  const component = fixture.componentInstance;
  return { fixture, component };
}

describe('PollCancelDialog', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza dialog quando open=true', async () => {
    const { fixture } = await setup(true);
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    expect(dialog).not.toBeNull();
  });

  it('não renderiza dialog quando open=false', async () => {
    const { fixture } = await setup(false);
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    expect(dialog).toBeNull();
  });

  it('não emite confirm com reason com menos de 10 caracteres', async () => {
    const { fixture, component } = await setup(true);
    const confirmSpy = vi.fn();
    component.confirm.subscribe(confirmSpy);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).reasonControl.setValue('curto');
    component.onConfirm();
    fixture.detectChanges();

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emite confirm com reason válido (>=10 chars)', async () => {
    const { fixture, component } = await setup(true);
    const confirmSpy = vi.fn();
    component.confirm.subscribe(confirmSpy);

    const validReason = 'Motivo válido com mais de dez caracteres';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).reasonControl.setValue(validReason);
    component.onConfirm();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(validReason);
  });

  it('emite close ao chamar onClose', async () => {
    const { component } = await setup(true);
    const closeSpy = vi.fn();
    component.close.subscribe(closeSpy);

    component.onClose();
    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('reseta o form quando open muda de false para true', async () => {
    const { fixture, component } = await setup(false);

    // Preenche o control diretamente (dialog fechado)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reasonControl = (component as any).reasonControl;
    reasonControl.setValue('algum motivo longo que tenha dez chars');
    reasonControl.markAsTouched();

    // Simula abertura (ngOnChanges via setInput manual)
    component.open = true;
    fixture.detectChanges();
    // Chama ngOnChanges manualmente simulando binding change
    component.ngOnChanges({ open: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();

    expect(reasonControl.value).toBe('');
    expect(reasonControl.untouched).toBe(true);
  });

  it('botão confirmar fica disabled enquanto reason é inválido', async () => {
    const { fixture } = await setup(true);

    const btns = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const confirmBtn = btns[btns.length - 1];
    expect(confirmBtn.nativeElement.disabled).toBe(true);
  });

  it('botão confirmar fica habilitado com reason válido', async () => {
    const { fixture, component } = await setup(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).reasonControl.setValue('Razão de cancelamento válida e longa');
    fixture.detectChanges();

    const btns = fixture.debugElement.queryAll(By.css('button[type="button"]'));
    const confirmBtn = btns[btns.length - 1];
    expect(confirmBtn.nativeElement.disabled).toBe(false);
  });

  it('exibe contador de caracteres', async () => {
    const { fixture, component } = await setup(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).reasonControl.setValue('12345678901234567890');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('20/500');
  });
});
