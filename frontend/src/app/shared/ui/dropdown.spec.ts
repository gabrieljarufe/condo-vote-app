import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, afterEach } from 'vitest';
import { Dropdown, DropdownOption } from './dropdown';

const OPTIONS: ReadonlyArray<DropdownOption<string>> = [
  { value: 'a', label: 'Opção A' },
  { value: 'b', label: 'Opção B' },
  { value: 'c', label: 'Opção C', disabled: true },
];

@Component({
  standalone: true,
  imports: [Dropdown],
  template: `
    <app-dropdown
      [options]="opts()"
      [value]="value()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      (valueChange)="lastChange = $event"
    />
  `,
})
class HostComponent {
  readonly opts = signal<ReadonlyArray<DropdownOption<string>>>(OPTIONS);
  readonly value = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly placeholder = signal('Escolha…');
  lastChange: string | null = null;
}

@Component({
  standalone: true,
  imports: [Dropdown, ReactiveFormsModule],
  template: `
    <app-dropdown [options]="opts" [formControl]="ctrl" />
  `,
})
class FormHostComponent {
  readonly opts = OPTIONS;
  readonly ctrl = new FormControl<string | null>(null);
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

async function setupForm() {
  await TestBed.configureTestingModule({ imports: [FormHostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(FormHostComponent);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

function getButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement {
  return fixture.nativeElement.querySelector('button[role="combobox"]') as HTMLButtonElement;
}

function isOpen(fixture: { nativeElement: HTMLElement }): boolean {
  return !!fixture.nativeElement.querySelector('[role="listbox"]');
}

describe('Dropdown', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renderiza placeholder quando sem valor', async () => {
    const { fixture } = await setup();
    expect(getButton(fixture).textContent).toContain('Escolha…');
  });

  it('renderiza label da opção selecionada', async () => {
    const { fixture, host } = await setup();
    host.value.set('b');
    fixture.detectChanges();
    expect(getButton(fixture).textContent).toContain('Opção B');
  });

  it('abre painel ao clicar no botão', async () => {
    const { fixture } = await setup();
    getButton(fixture).click();
    fixture.detectChanges();
    expect(isOpen(fixture)).toBe(true);
  });

  it('ESC fecha o painel', async () => {
    const { fixture } = await setup();
    getButton(fixture).click();
    fixture.detectChanges();
    getButton(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(isOpen(fixture)).toBe(false);
  });

  it('click fora fecha o painel', async () => {
    const { fixture } = await setup();
    getButton(fixture).click();
    fixture.detectChanges();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(isOpen(fixture)).toBe(false);
  });

  it('selecionar opção emite valueChange e fecha o painel', async () => {
    const { fixture, host } = await setup();
    getButton(fixture).click();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>;
    items[1].click();
    fixture.detectChanges();
    expect(host.lastChange).toBe('b');
    expect(isOpen(fixture)).toBe(false);
  });

  it('ArrowDown navega para próxima opção habilitada', async () => {
    const { fixture, host } = await setup();
    getButton(fixture).click();
    fixture.detectChanges();
    getButton(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    getButton(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(host.lastChange).toBe('a');
  });

  it('respeita disabled global', async () => {
    const { fixture, host } = await setup();
    host.disabled.set(true);
    fixture.detectChanges();
    getButton(fixture).click();
    fixture.detectChanges();
    expect(isOpen(fixture)).toBe(false);
  });

  it('não seleciona opção disabled', async () => {
    const { fixture, host } = await setup();
    getButton(fixture).click();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>;
    items[2].click();
    fixture.detectChanges();
    expect(host.lastChange).toBeNull();
  });

  it('integra com FormControl (writeValue + onChange)', async () => {
    const { fixture, host } = await setupForm();
    host.ctrl.setValue('b');
    fixture.detectChanges();
    expect(getButton(fixture).textContent).toContain('Opção B');
    getButton(fixture).click();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>;
    items[0].click();
    expect(host.ctrl.value).toBe('a');
  });

  it('FormControl.disable propaga para o componente', async () => {
    const { fixture, host } = await setupForm();
    host.ctrl.disable();
    fixture.detectChanges();
    expect(getButton(fixture).disabled).toBe(true);
  });
});
