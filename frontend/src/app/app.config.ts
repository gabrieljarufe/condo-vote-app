import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { supabaseClientProvider } from './core/auth/supabase.client';
import { authInterceptor } from './core/http/auth.interceptor';
import { tenantInterceptor } from './core/http/tenant.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, tenantInterceptor])),
    supabaseClientProvider,
  ],
};
