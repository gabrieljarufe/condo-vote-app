import { Component, Input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { Dropdown } from '../../shared/ui/dropdown';
import { ApartmentBulkGeneratorForm } from './apartment-bulk-generator-form';
import { GeneratedApartment } from './generate-apartments';

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
    imports: [ApartmentBulkGeneratorForm],
  })
    .overrideComponent(ApartmentBulkGeneratorForm, {
      set: { imports: [FormFieldStub, ReactiveFormsModule, Dropdown] },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(ApartmentBulkGeneratorForm);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component };
}

describe('ApartmentBulkGeneratorForm', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('form inicia com valores default', async () => {
    const { component } = await setup();
    const v = component.form.getRawValue();
    expect(v.block).toBe('');
    expect(v.floorStart).toBe(1);
    expect(v.floorEnd).toBe(12);
    expect(v.unitsPerFloor).toBe(4);
    expect(v.pattern).toBe('{andar}{seq:02}');
    expect(v.skipFloorsRaw).toBe('');
  });

  it('form default é válido', async () => {
    const { component } = await setup();
    expect(component.form.valid).toBe(true);
  });

  it('botão "Gerar preview" está desabilitado quando form inválido', async () => {
    const { fixture, component } = await setup();
    component.form.controls.floorStart.setValue(null);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('botão "Gerar preview" está habilitado quando form válido', async () => {
    const { fixture } = await setup();
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('erro floorRangeInvalid quando floorEnd < floorStart', async () => {
    const { component } = await setup();
    component.form.controls.floorStart.setValue(10);
    component.form.controls.floorEnd.setValue(5);
    expect(component.form.errors?.['floorRangeInvalid']).toBe(true);
    expect(component.form.valid).toBe(false);
  });

  it('sem erro floorRangeInvalid quando floorEnd === floorStart', async () => {
    const { component } = await setup();
    component.form.controls.floorStart.setValue(5);
    component.form.controls.floorEnd.setValue(5);
    expect(component.form.errors?.['floorRangeInvalid']).toBeUndefined();
  });

  it('erro tooManyApartments quando resultado > 500', async () => {
    const { component } = await setup();
    // 50 unitsPerFloor * 11 andares (1..11) = 550 > 500
    component.form.controls.floorStart.setValue(1);
    component.form.controls.floorEnd.setValue(11);
    component.form.controls.unitsPerFloor.setValue(50);
    expect(component.form.errors?.['tooManyApartments']).toBe(true);
  });

  it('sem erro tooManyApartments quando resultado <= 500', async () => {
    const { component } = await setup();
    component.form.controls.floorStart.setValue(1);
    component.form.controls.floorEnd.setValue(10);
    component.form.controls.unitsPerFloor.setValue(4);
    expect(component.form.errors?.['tooManyApartments']).toBeUndefined();
  });

  it('emite generate com array correto ao clicar Gerar preview com form válido', async () => {
    const { fixture, component } = await setup();
    component.form.controls.floorStart.setValue(1);
    component.form.controls.floorEnd.setValue(2);
    component.form.controls.unitsPerFloor.setValue(2);
    component.form.controls.pattern.setValue('{andar}{seq:02}');
    fixture.detectChanges();

    const emitted: GeneratedApartment[][] = [];
    fixture.componentInstance.generate.subscribe((v: GeneratedApartment[]) => emitted.push(v));

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toHaveLength(4); // 2 andares * 2 aptos
    expect(emitted[0][0].unitNumber).toBe('101');
    expect(emitted[0][1].unitNumber).toBe('102');
    expect(emitted[0][2].unitNumber).toBe('201');
    expect(emitted[0][3].unitNumber).toBe('202');
  });

  it('preview em tempo real mostra contagem correta', async () => {
    const { component } = await setup();
    component.form.controls.floorStart.setValue(1);
    component.form.controls.floorEnd.setValue(3);
    component.form.controls.unitsPerFloor.setValue(4);
    component.form.controls.pattern.setValue('{andar}{seq:02}');

    const previewText = component.preview();
    // 3 andares * 4 aptos = 12
    expect(previewText).toContain('12 apartamentos');
  });

  it('preview é null quando form inválido', async () => {
    const { component } = await setup();
    component.form.controls.floorStart.setValue(10);
    component.form.controls.floorEnd.setValue(5); // floorRangeInvalid
    expect(component.preview()).toBeNull();
  });

  it('skipFloors parseia corretamente ignorando valores não-numéricos', async () => {
    const { component } = await setup();
    component.form.controls.skipFloorsRaw.setValue('13, 4, abc, 7');
    const parsed = component.skipFloors();
    expect(parsed).toEqual([13, 4, 7]);
  });

  it('apartamentos de andares pulados não aparecem no preview', async () => {
    const { component } = await setup();
    component.form.controls.floorStart.setValue(1);
    component.form.controls.floorEnd.setValue(3);
    component.form.controls.unitsPerFloor.setValue(4);
    component.form.controls.skipFloorsRaw.setValue('2');

    const previewText = component.preview();
    // 2 andares (1 e 3) * 4 aptos = 8
    expect(previewText).toContain('8 apartamentos');
  });

  it('padrão customizado é usado quando pattern é "custom"', async () => {
    const { component } = await setup();
    component.form.controls.pattern.setValue('custom');
    component.form.controls.customPattern.setValue('{andar}-{seq}');
    component.form.controls.floorStart.setValue(1);
    component.form.controls.floorEnd.setValue(1);
    component.form.controls.unitsPerFloor.setValue(2);

    expect(component.form.valid).toBe(true);
    const previewText = component.preview();
    expect(previewText).toContain('1-1');
  });

  it('form inválido quando pattern é "custom" e customPattern está vazio', async () => {
    const { component } = await setup();
    component.form.controls.pattern.setValue('custom');
    component.form.controls.customPattern.setValue('');
    expect(component.form.valid).toBe(false);
  });

  it('presets têm os 5 valores esperados', async () => {
    const { component } = await setup();
    const presets = component.presets;
    expect(presets).toHaveLength(5);
    expect(presets.map((p: { value: string }) => p.value)).toContain('custom');
    expect(presets.map((p: { value: string }) => p.value)).toContain('{andar}{seq:02}');
    expect(presets.map((p: { value: string }) => p.value)).toContain('{andar}{seq}');
  });
});
