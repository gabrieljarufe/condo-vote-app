import { Routes } from '@angular/router';
import { adminGuard } from '../../core/tenant/admin.guard';
import { tenantRestoreGuard } from '../../core/tenant/tenant-restore.guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home'),
  },
  {
    path: 'condominiums/:condoId',
    canActivate: [tenantRestoreGuard],
    loadComponent: () => import('../condominiums/condominium-dashboard'),
  },
  {
    path: 'condominiums/:condoId/apartments',
    canActivate: [tenantRestoreGuard],
    loadComponent: () => import('../apartments/apartments-page'),
  },
  {
    path: 'condominiums/:condoId/apartments/bulk',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../apartments/apartments-bulk-page'),
  },
  {
    path: 'condominiums/:condoId/invitations',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../invitations/invitations-page'),
  },
  {
    path: 'condominiums/:condoId/invitations/bulk',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../invitations/invitation-bulk/invitation-bulk-page'),
  },
  {
    path: 'condominiums/:condoId/polls',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../polls/polls-page'),
  },
  {
    path: 'condominiums/:condoId/polls/new',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../polls/poll-create-page'),
  },
  {
    path: 'condominiums/:condoId/polls/:pollId',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../polls/poll-detail-page'),
  },
  {
    path: 'condominiums/:condoId/polls/:pollId/edit',
    canActivate: [tenantRestoreGuard, adminGuard],
    loadComponent: () => import('../polls/poll-edit-page'),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export default routes;
