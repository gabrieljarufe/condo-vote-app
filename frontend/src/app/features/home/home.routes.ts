import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home'),
  },
  {
    path: 'condominiums/:condoId/apartments',
    loadComponent: () => import('../apartments/apartments-page'),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export default routes;
