import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  function setMatchMedia(prefersDark: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  it('default = light quando SO não pede dark e localStorage está vazio', () => {
    setMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    expect(service.current()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('default = dark quando SO pede dark', () => {
    setMatchMedia(true);
    const service = TestBed.inject(ThemeService);
    expect(service.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('lê preferência persistida e ignora SO', () => {
    setMatchMedia(true); // SO diz dark
    localStorage.setItem('theme', 'light');
    const service = TestBed.inject(ThemeService);
    expect(service.current()).toBe('light');
  });

  it('toggle alterna light → dark', () => {
    setMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('toggle alterna dark → light', () => {
    setMatchMedia(true);
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.current()).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('setTheme define e persiste', () => {
    setMatchMedia(false);
    const service = TestBed.inject(ThemeService);
    service.setTheme('dark');
    expect(service.current()).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('ignora valores inválidos persistidos', () => {
    setMatchMedia(false);
    localStorage.setItem('theme', 'rainbow');
    const service = TestBed.inject(ThemeService);
    expect(service.current()).toBe('light'); // cai no fallback do SO
  });
});
