import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renderiza com aria-label de "modo escuro" quando atual é light', () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Alternar para modo escuro');
    const icon = fixture.debugElement.query(By.css('.material-symbols-outlined')).nativeElement as HTMLElement;
    expect(icon.textContent?.trim()).toBe('dark_mode');
  });

  it('click alterna o tema e atualiza o aria-label', () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Alternar para modo claro');
    const icon = fixture.debugElement.query(By.css('.material-symbols-outlined')).nativeElement as HTMLElement;
    expect(icon.textContent?.trim()).toBe('light_mode');
  });

  it('target a11y mínimo (44×44 via w-11 h-11)', () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLElement;
    expect(button.className).toContain('w-11');
    expect(button.className).toContain('h-11');
  });
});
