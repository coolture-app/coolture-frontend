import { Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';
import { FullPostView } from './features/full-post-view/full-post-view';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { NotFoundView } from './features/not-found-view/not-found-view';
import { AddPostView } from './features/add-post-view/add-post-view';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainPage,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('MAIN_PAGE.title');
    },
  },
  {
    path: 'post/:id',
    component: FullPostView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('FULL_POST.title');
    },
  },
  {
    path: 'addPost',
    component: AddPostView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('ADD_POST.title');
    },
  },
  // ** WILDCARD must be on the bottom of the router!
  {
    path: '**',
    component: NotFoundView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('404.title');
    },
  },
];
