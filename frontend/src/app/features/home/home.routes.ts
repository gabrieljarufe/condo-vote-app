import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home'),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

export default routes;
