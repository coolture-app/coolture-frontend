import { Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';
import { FullPostView } from './features/full-post-view/full-post-view';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';

export const routes: Routes = [
  {
    path: '',
    component: MainPage,
    title: (route) => {
      const translate = inject(TranslateService);
      return translate.get('MAIN_PAGE.title');
    },
  },
  {
    path: 'post/:id',
    component: FullPostView,
    title: (route) => {
      const translate = inject(TranslateService);
      return translate.get('FULL_POST.title');
    },
  },
];
