import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ApartmentCreateChooser } from './apartment-create-chooser';

async function setup() {
  await TestBed.configureTestingModule({
    imports: [ApartmentCreateChooser],
  }).compileComponents();
  const fixture = TestBed.createComponent(ApartmentCreateChooser);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ApartmentCreateChooser', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('clicar card 1 emite chooseOne', async () => {
    const { fixture, component } = await setup();
    const spy = vi.fn();
    component.chooseOne.subscribe(spy);
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clicar card 2 emite chooseBulk', async () => {
    const { fixture, component } = await setup();
    const spy = vi.fn();
    component.chooseBulk.subscribe(spy);
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('tecla Esc emite close', async () => {
    const { component } = await setup();
    const spy = vi.fn();
    component.close.subscribe(spy);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('click no backdrop emite close', async () => {
    const { fixture, component } = await setup();
    const spy = vi.fn();
    component.close.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('[data-dialog-backdrop]') as HTMLElement;
    backdrop.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
