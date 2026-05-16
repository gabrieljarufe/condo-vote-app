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
    path: '**',
    redirectTo: '',
  },
];

export default routes;
