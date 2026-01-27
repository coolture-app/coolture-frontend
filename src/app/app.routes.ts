import { Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';

export const routes: Routes = [
  {
    path: '',
    component: MainPage,
    title: 'Strona główna!',
  },
];
