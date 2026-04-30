import { Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';
import { FullPostView } from './features/full-post-view/full-post-view';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { NotFoundView } from './features/not-found-view/not-found-view';
import { AddPostView } from './features/add-post-view/add-post-view';
import { DiscoverView } from './features/discover-view/discover-view';
import { ApiTestView } from './features/api-test-view/api-test-view';
import { UserProfileView } from './features/my-profile-view/my-profile-view';
import { authGuard } from './core/auth/auth.guard';
import { EditPostView } from './features/edit-post-view/edit-post-view';
import { MyEventsView } from './features/my-events-view/my-events-view';

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
    path: 'login',
    redirectTo: '/',
    pathMatch: 'full',
  },
  {
    path: 'logout',
    redirectTo: '/',
    pathMatch: 'full',
  },
  {
    path: 'post/:id',
    component: FullPostView,
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
  {
    path: 'profile',
    component: UserProfileView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('PROFILE.title');
    },
  },
  {
    path: 'u/:username',
    component: UserProfileView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('PROFILE.title');
    },
  },
  {
    path: 'discover',
    component: DiscoverView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('DISCOVER.title');
    },
  },
  {
    path: 'editPost/:id',
    component: EditPostView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('EDIT_POST.title');
    },
  },
  {
    path: 'myEvents',
    component: MyEventsView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('MY_EVENTS.title');
    },
  },
  {
    path: 'api-test',
    component: ApiTestView,
    canActivate: [authGuard],
    title: 'API Test Runner',
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
