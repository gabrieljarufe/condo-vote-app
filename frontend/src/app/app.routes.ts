import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * Top-level routes (lazy-loaded).
 *   /        público — landing
 *   /login   público — entrar (Supabase)
 *   /app/**  protegido pelo authGuard — área autenticada
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing'),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login'),
  },
  {
    path: 'invitations/:token',
    loadComponent: () => import('./features/onboarding/invitation-accept-page'),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadChildren: () => import('./features/home/home.routes'),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
