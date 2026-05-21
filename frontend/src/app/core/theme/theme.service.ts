import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Tema visual do app (light/dark).
 *
 * Estratégia híbrida documentada em `docs/ux/visual-identity-decision.md` §4
 * e refinada após pedido do usuário por toggle:
 *  - Primeira visita (sem escolha persistida): segue `prefers-color-scheme`
 *    do SO via @media no styles.scss.
 *  - Após toggle: a escolha vence o SO e é persistida em localStorage.
 *
 * Aplica `data-theme="light|dark"` em `<html>` — CSS reage via
 * `:root[data-theme="dark"]` e `:root:not([data-theme="light"])` no @media.
 * Inline script no `index.html` aplica o atributo antes do paint para
 * evitar flash em refresh.
 *
 * Difere do `TenantService` (em memória) porque preferência visual NÃO é
 * estado de sessão — é preferência de a11y/UX universal, padrão em qualquer
 * app moderno usar localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _current = signal<Theme>(this.detectInitial());
  readonly current = this._current.asReadonly();

  constructor() {
    this.apply(this._current());
  }

  toggle(): void {
    this.setTheme(this._current() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this._current.set(theme);
    this.apply(theme);
    this.persist(theme);
  }

  private detectInitial(): Theme {
    const stored = this.readStored();
    if (stored) return stored;
    const win = this.document.defaultView;
    if (typeof win?.matchMedia === 'function' && win.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  private readStored(): Theme | null {
    try {
      const raw = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
      return raw === 'light' || raw === 'dark' ? raw : null;
    } catch {
      return null;
    }
  }

  private persist(theme: Theme): void {
    try {
      this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, theme);
    } catch {
      /* privacy mode / iframe — silenciosamente desiste de persistir */
    }
  }

  private apply(theme: Theme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
