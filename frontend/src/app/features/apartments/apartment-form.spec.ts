import { Component, Input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ApartmentForm } from './apartment-form';

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

async function setup() {
  await TestBed.configureTestingModule({
    imports: [ApartmentForm],
    providers: [provideRouter([])],
  })
    .overrideComponent(ApartmentForm, { set: { imports: [FormFieldStub, ReactiveFormsModule] } })
    .compileComponents();
  const fixture = TestBed.createComponent(ApartmentForm);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ApartmentForm', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('inicia com form inválido (unitNumber obrigatório)', async () => {
    const { component } = await setup();
    expect(component.form.invalid).toBe(true);
  });

  it('form válido quando unitNumber preenchido', async () => {
    const { component } = await setup();
    component.unitNumber.setValue('101');
    expect(component.form.valid).toBe(true);
  });

  it('emite submit com unitNumber e block', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.submit$.subscribe(spy);
    component.unitNumber.setValue('101');
    component.block.setValue('A');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).submit();
    expect(spy).toHaveBeenCalledWith({ unitNumber: '101', block: 'A' });
  });

  it('não emite submit quando form inválido', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.submit$.subscribe(spy);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).submit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('setError define mensagem de erro', async () => {
    const { component } = await setup();
    component.setError('Erro de teste');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).errorMessage()).toBe('Erro de teste');
  });

  it('ngOnInit limpa mensagem de erro', async () => {
    const { component } = await setup();
    component.setError('Erro anterior');
    component.ngOnInit();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).errorMessage()).toBeNull();
  });

  it('renderiza input para unitNumber no DOM', async () => {
    const { fixture } = await setup();
    const input = fixture.nativeElement.querySelector('input[formcontrolname="unitNumber"]');
    expect(input).not.toBeNull();
  });

  it('renderiza input para block no DOM', async () => {
    const { fixture } = await setup();
    const input = fixture.nativeElement.querySelector('input[formcontrolname="block"]');
    expect(input).not.toBeNull();
  });

  it('label[for] do unitNumber coincide com input[id]', async () => {
    const { fixture } = await setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[formcontrolname="unitNumber"]',
    );
    expect(input).not.toBeNull();
    const label: HTMLLabelElement = fixture.nativeElement.querySelector(
      `label[for="${input.id}"]`,
    );
    expect(label).not.toBeNull();
  });

  it('label[for] do block coincide com input[id]', async () => {
    const { fixture } = await setup();
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[formcontrolname="block"]',
    );
    expect(input).not.toBeNull();
    const label: HTMLLabelElement = fixture.nativeElement.querySelector(
      `label[for="${input.id}"]`,
    );
    expect(label).not.toBeNull();
  });
});
