import { InjectionToken, Provider } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Token para o singleton do Supabase JS SDK.
 * Centraliza a criação do client em um único lugar — testes substituem
 * via TestBed.overrideProvider(SUPABASE_CLIENT, { useValue: mock }).
 */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export const supabaseClientProvider: Provider = {
  provide: SUPABASE_CLIENT,
  useFactory: () =>
    createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
};
