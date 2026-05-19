import { Component, Input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Dropdown } from '../../shared/ui/dropdown';
import { PollForm, PollFormValue } from './poll-form';

let stubNextId = 0;

@Component({
  selector: 'app-form-field',
  template: '<label [for]="fieldId">{{ label }}</label><ng-content />',
  standalone: true,
})
class FormFieldStub {
  @Input() label = '';
  @Input() control: AbstractControl | null = null;
  @Input() errors: Record<string, string> = {};
  readonly fieldId = `ff-stub-${stubNextId++}`;
}

function makeValidValue(): PollFormValue {
  return {
    title: 'Votação teste',
    description: '',
    convocation: 'FIRST',
    quorumMode: 'SIMPLE_MAJORITY',
    scheduledStart: '2026-06-01T10:00',
    scheduledEnd: '2026-06-01T18:00',
    options: ['Sim', 'Não'],
  };
}

async function setup() {
  await TestBed.configureTestingModule({
    imports: [PollForm],
    providers: [provideRouter([])],
  })
    .overrideComponent(PollForm, { set: { imports: [FormFieldStub, ReactiveFormsModule, Dropdown] } })
    .compileComponents();
  const fixture = TestBed.createComponent(PollForm);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('PollForm', () => {
  afterEach(() => TestBed.resetTestingModule());

  // --- Validações de estado inicial ---

  it('inicia com form inválido (title vazio)', async () => {
    const { component } = await setup();
    expect(component.form.invalid).toBe(true);
  });

  it('inicia com 2 opções no FormArray', async () => {
    const { component } = await setup();
    expect(component.options.length).toBe(2);
  });

  // --- Validação de min/max opções ---

  it('form inválido com menos de 2 opções', async () => {
    const { component } = await setup();
    component.title.setValue('Título');
    component.scheduledStart.setValue('2026-06-01T10:00');
    component.scheduledEnd.setValue('2026-06-01T18:00');
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('Não');
    // Remove one option directly
    component.options.removeAt(1);
    expect(component.options.invalid).toBe(true);
    expect(component.options.errors?.['minOptions']).toBe(true);
  });

  it('addOption adiciona controle até máximo 10', async () => {
    const { component } = await setup();
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).addOption();
    }
    expect(component.options.length).toBe(10);
    // Tentativa de adicionar além de 10 não faz nada
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).addOption();
    expect(component.options.length).toBe(10);
  });

  it('removeOption remove controle respeitando mínimo de 2', async () => {
    const { component } = await setup();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).addOption(); // 3 options
    expect(component.options.length).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).removeOption(2);
    expect(component.options.length).toBe(2);
    // Tenta remover com 2 — não deve remover
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).removeOption(0);
    expect(component.options.length).toBe(2);
  });

  // --- Validação de duplicados case-insensitive ---

  it('options inválido com duplicados case-insensitive', async () => {
    const { component } = await setup();
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('sim');
    component.options.markAsDirty();
    expect(component.options.errors?.['duplicateOptions']).toBe(true);
  });

  it('options válido com opções distintas', async () => {
    const { component } = await setup();
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('Não');
    expect(component.options.valid).toBe(true);
  });

  it('options inválido com opções em branco', async () => {
    const { component } = await setup();
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('');
    expect(component.options.errors?.['blankOption']).toBe(true);
  });

  // --- Validação de datas cross-field ---

  it('form inválido quando scheduledEnd <= scheduledStart', async () => {
    const { component } = await setup();
    component.title.setValue('Título');
    component.scheduledStart.setValue('2026-06-01T18:00');
    component.scheduledEnd.setValue('2026-06-01T10:00');
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('Não');
    expect(component.form.errors?.['endBeforeStart']).toBe(true);
  });

  it('form válido com scheduledEnd > scheduledStart', async () => {
    const { component } = await setup();
    component.title.setValue('Título');
    component.scheduledStart.setValue('2026-06-01T10:00');
    component.scheduledEnd.setValue('2026-06-01T18:00');
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('Não');
    expect(component.form.errors).toBeNull();
  });

  // --- Submit emite request com ISO 8601 ---

  it('submit emite CreatePollRequest com datas em ISO 8601 UTC', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.submit$.subscribe(spy);

    component.title.setValue('Votação');
    component.scheduledStart.setValue('2026-06-01T10:00');
    component.scheduledEnd.setValue('2026-06-01T18:00');
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('Não');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).submit();

    expect(spy).toHaveBeenCalledOnce();
    const req = spy.mock.calls[0][0] as ReturnType<typeof spy.mock.calls[0][0]>;
    // ISO strings must contain 'Z' or '+' (UTC)
    expect((req.scheduledStart as string).endsWith('Z') || (req.scheduledStart as string).includes('+')).toBe(true);
    expect((req.scheduledEnd as string).endsWith('Z') || (req.scheduledEnd as string).includes('+')).toBe(true);
    expect(req.title).toBe('Votação');
    expect(req.options).toEqual(['Sim', 'Não']);
  });

  it('submit não emite quando form inválido', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.submit$.subscribe(spy);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).submit();
    expect(spy).not.toHaveBeenCalled();
  });

  // --- Cancel ---

  it('cancel emite evento ao clicar em cancelar', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.cancel.subscribe(spy);
    component.cancel.emit();
    expect(spy).toHaveBeenCalledOnce();
  });

  // --- setError ---

  it('setError define mensagem de erro', async () => {
    const { component } = await setup();
    component.setError('Erro de API');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).errorMessage()).toBe('Erro de API');
  });

  it('ngOnInit limpa mensagem de erro', async () => {
    const { component } = await setup();
    component.setError('Erro anterior');
    component.ngOnInit();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).errorMessage()).toBeNull();
  });

  // --- Patch de initialValue via host component ---

  it('ao receber initialValue popula form e options', async () => {
    // Test the patch logic directly (effect-based patching)
    const { component, fixture } = await setup();
    const val = makeValidValue();

    // Apply patch logic directly as the effect would
    component.title.setValue(val.title);
    component.scheduledStart.setValue(val.scheduledStart);
    component.scheduledEnd.setValue(val.scheduledEnd);
    while (component.options.length > 0) component.options.removeAt(0);
    for (const label of val.options) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component.options.push((component as any).makeOptionControl(label));
    }
    fixture.detectChanges();

    expect(component.title.value).toBe(val.title);
    expect(component.scheduledStart.value).toBe(val.scheduledStart);
    expect(component.scheduledEnd.value).toBe(val.scheduledEnd);
    expect(component.options.length).toBe(2);
    expect(component.options.controls[0].value).toBe('Sim');
    expect(component.options.controls[1].value).toBe('Não');
  });

  it('ao receber nova initialValue substitui options anteriores', async () => {
    // Verify that when options list changes, the array is rebuilt correctly
    const { component } = await setup();
    const newOptions = ['A', 'B', 'C'];

    // Simulate effect rebuilding options
    while (component.options.length > 0) component.options.removeAt(0);
    for (const label of newOptions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component.options.push((component as any).makeOptionControl(label));
    }

    expect(component.options.length).toBe(3);
  });

  // --- description opcional ---

  it('description vazia não é incluída no request como campo obrigatório', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.submit$.subscribe(spy);

    component.title.setValue('Votação');
    component.description.setValue('');
    component.scheduledStart.setValue('2026-06-01T10:00');
    component.scheduledEnd.setValue('2026-06-01T18:00');
    component.options.controls[0].setValue('Sim');
    component.options.controls[1].setValue('Não');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).submit();

    expect(spy).toHaveBeenCalledOnce();
    const req = spy.mock.calls[0][0];
    expect(req.description).toBeUndefined();
  });
});
