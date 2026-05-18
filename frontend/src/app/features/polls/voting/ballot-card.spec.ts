import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { BallotCard } from './ballot-card';
import { PollOptionResponse } from '../../../core/api/polls-api.service';

const OPTIONS: ReadonlyArray<PollOptionResponse> = [
  { id: 'opt-1', label: 'Sim', displayOrder: 0 },
  { id: 'opt-2', label: 'Não', displayOrder: 1 },
];

async function setup(overrides: Partial<{
  apartmentLabel: string;
  options: ReadonlyArray<PollOptionResponse>;
  selectedOptionId: string | null;
  disabled: boolean;
  radioGroupName: string;
}> = {}) {
  await TestBed.configureTestingModule({
    imports: [BallotCard],
  }).compileComponents();

  const fixture = TestBed.createComponent(BallotCard);
  const component = fixture.componentInstance;

  component.apartmentLabel = overrides.apartmentLabel ?? '101';
  component.options = overrides.options ?? OPTIONS;
  if (overrides.selectedOptionId !== undefined) component.selectedOptionId = overrides.selectedOptionId;
  if (overrides.disabled !== undefined) component.disabled = overrides.disabled;
  if (overrides.radioGroupName !== undefined) component.radioGroupName = overrides.radioGroupName;

  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, component, el };
}

describe('BallotCard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza apartmentLabel e options', async () => {
    const { el } = await setup({ apartmentLabel: '202' });

    expect(el.textContent).toContain('202');
    expect(el.textContent).toContain('Sim');
    expect(el.textContent).toContain('Não');
  });

  it('marca opção selecionada visualmente', async () => {
    const { el } = await setup({ selectedOptionId: 'opt-1' });

    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const opt1Radio = Array.from(radios).find((r) => r.value === 'opt-1');
    const opt2Radio = Array.from(radios).find((r) => r.value === 'opt-2');

    expect(opt1Radio?.checked).toBe(true);
    expect(opt2Radio?.checked).toBe(false);
  });

  it('emite optionChange ao clicar em radio', async () => {
    const { fixture, component, el } = await setup();
    const spy = vi.fn();
    component.optionChange.subscribe(spy);

    const radio = el.querySelector<HTMLInputElement>('input[value="opt-2"]')!;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith('opt-2');
  });

  it('não emite quando disabled=true e usuário tenta clicar', async () => {
    const { fixture, component, el } = await setup({ disabled: true });
    const spy = vi.fn();
    component.optionChange.subscribe(spy);

    const radio = el.querySelector<HTMLInputElement>('input[value="opt-1"]')!;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('mostra badge "✓ Confirmado" quando disabled e selectedOptionId definido', async () => {
    const { el } = await setup({ disabled: true, selectedOptionId: 'opt-1' });

    expect(el.textContent).toContain('✓ Confirmado');
  });

  it('não mostra badge quando disabled mas selectedOptionId é null', async () => {
    const { el } = await setup({ disabled: true, selectedOptionId: null });

    expect(el.textContent).not.toContain('✓ Confirmado');
  });

  it('não mostra badge quando selectedOptionId definido mas não disabled', async () => {
    const { el } = await setup({ disabled: false, selectedOptionId: 'opt-1' });

    expect(el.textContent).not.toContain('✓ Confirmado');
  });

  it('inputs de radio usam o radioGroupName informado', async () => {
    const { el } = await setup({ radioGroupName: 'ballot-apt-101' });

    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    radios.forEach((r) => {
      expect(r.name).toBe('ballot-apt-101');
    });
  });

  it('renderiza com múltiplas opções', async () => {
    const manyOptions: ReadonlyArray<PollOptionResponse> = [
      { id: 'o1', label: 'Opção A', displayOrder: 0 },
      { id: 'o2', label: 'Opção B', displayOrder: 1 },
      { id: 'o3', label: 'Opção C', displayOrder: 2 },
    ];
    const { el } = await setup({ options: manyOptions });

    const radios = el.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(3);
    expect(el.textContent).toContain('Opção A');
    expect(el.textContent).toContain('Opção C');
  });

  it('fieldset tem atributo disabled quando disabled=true', async () => {
    const { fixture } = await setup({ disabled: true });
    const fieldset = fixture.debugElement.query(By.css('fieldset'));
    expect(fieldset.nativeElement.disabled).toBe(true);
  });
});
