import { Routes } from '@angular/router';
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
    canActivate: [tenantRestoreGuard],
    loadComponent: () => import('../apartments/apartments-bulk-page'),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export default routes;
