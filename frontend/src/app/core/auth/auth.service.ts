import { Injectable, computed, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.client';

/**
 * Wrapper sobre o Supabase JS SDK.
 *
 * Responsabilidades:
 * - Expor a sessão atual como signal reativo (`session`, `isAuthenticated`)
 * - Métodos de signIn/signOut
 * - Acesso síncrono ao access token (usado pelo AuthInterceptor)
 *
 * Refresh de token é delegado ao Supabase SDK (autoRefreshToken: true).
 * Se um 401 chegar mesmo assim, o guard cuida do redirect — não fazemos retry manual.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  private readonly _session = signal<Session | null>(null);
  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor() {
    void this.supabase.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Acesso síncrono ao access token. Retorna null se não autenticado.
   * Usado pelo AuthInterceptor — não pode ser async porque interceptors são síncronos.
   */
  accessToken(): string | null {
    return this._session()?.access_token ?? null;
  }
}
