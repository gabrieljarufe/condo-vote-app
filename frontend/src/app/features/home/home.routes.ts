import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { adminGuard } from '../../core/tenant/admin.guard';
import { tenantRestoreGuard } from '../../core/tenant/tenant-restore.guard';

const routes: Routes = [
  {
    // Seleção de condomínio — fora do shell autenticado (sem header/bottom-nav de condo).
    path: '',
    loadComponent: () => import('./home'),
  },
  {
    // Shell autenticado: header + bottom-nav renderizados uma vez para todos os
    // filhos. `tenantRestoreGuard` no pai cobre os filhos (não duplicar).
    // `paramsInheritanceStrategy: 'always'` (app.config.ts) faz os filhos
    // herdarem `:condoId` — os componentes que leem `route.snapshot.params['condoId']`
    // continuam funcionando sem alteração.
    path: 'condominiums/:condoId',
    canActivate: [tenantRestoreGuard],
    loadComponent: () => import('../../shared/layout/authenticated-shell'),
    children: [
      {
        path: '',
        loadComponent: () => import('../condominiums/condominium-dashboard'),
      },
      {
        path: 'apartments',
        loadComponent: () => import('../apartments/apartments-page'),
      },
      {
        path: 'apartments/bulk',
        canActivate: [adminGuard],
        loadComponent: () => import('../apartments/apartments-bulk-page'),
      },
      {
        path: 'invitations',
        canActivate: [adminGuard],
        loadComponent: () => import('../invitations/invitations-page'),
      },
      {
        path: 'invitations/bulk',
        canActivate: [adminGuard],
        loadComponent: () => import('../invitations/invitation-bulk/invitation-bulk-page'),
      },
      {
        path: 'polls',
        loadComponent: () => import('../polls/polls-page'),
      },
      {
        path: 'polls/new',
        canActivate: [adminGuard],
        loadComponent: () => import('../polls/poll-create-page'),
      },
      {
        path: 'polls/:pollId',
        loadComponent: () => import('../polls/poll-detail-page'),
      },
      {
        path: 'polls/:pollId/edit',
        canActivate: [adminGuard],
        loadComponent: () => import('../polls/poll-edit-page'),
      },
      {
        // Legado: /my-polls → /polls?tab=pendentes (preserva links antigos em e-mails).
        path: 'my-polls',
        canActivate: [
          (route) => {
            const router = inject(Router);
            const condoId = route.params['condoId'];
            return router.createUrlTree(['/app/condominiums', condoId, 'polls'], {
              queryParams: { tab: 'pendentes' },
            });
          },
        ],
        children: [],
      },
      {
        path: 'polls/:pollId/vote',
        loadComponent: () => import('../polls/voting/ballot-vote-page'),
      },
      {
        path: 'polls/:pollId/vote/review',
        loadComponent: () => import('../polls/voting/ballot-review-page'),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export default routes;
