import { RedirectFunction, Router, Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';
import { FullPostView } from './features/full-post-view/full-post-view';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { NotFoundView } from './features/not-found-view/not-found-view';
import { AddPostView } from './features/add-post-view/add-post-view';
import { DiscoverView } from './features/discover-view/discover-view';
import { UserProfileView } from './features/my-profile-view/my-profile-view';
import { authGuard } from './core/auth/auth.guard';
import { EditPostView } from './features/edit-post-view/edit-post-view';
import { MyEventsView } from './features/my-events-view/my-events-view';
import { AuthCallbackView } from './features/auth-callback-view/auth-callback-view';
import { HiddenPostsView } from './features/hidden-posts-view/hidden-posts-view';
import { InterestsView, unsavedInterestsGuard } from './features/interests-view/interests-view';

/**
 * Sends a moved path to its new one, with `:name` filled from the old path. A function because a
 * string redirect loses the query string and fragment, on the server as well as in the browser.
 */
function movedTo(path: string): RedirectFunction {
  return ({ params, queryParams, fragment }) => {
    // As separate segments, because createUrlTree encodes each one itself.
    const segments = path
      .split('/')
      .map((part) => (part[0] === ':' ? params[part.slice(1)] : part));
    return inject(Router).createUrlTree(['/', ...segments.filter(Boolean)], {
      queryParams,
      fragment: fragment ?? undefined,
    });
  };
}

/** The app's old paths and where they went, so saved links keep working. */
export const MOVED_ROUTES: Routes = [
  { path: 'post/:id', redirectTo: movedTo('/posts/:id') },
  { path: 'addPost', redirectTo: movedTo('/posts/new') },
  { path: 'editPost/:id', redirectTo: movedTo('/posts/:id/edit') },
  { path: 'myEvents', redirectTo: movedTo('/plans') },
  { path: 'u/:username', redirectTo: movedTo('/users/:username') },
  { path: 'discover', redirectTo: movedTo('/people') },
  { path: 'interests', redirectTo: movedTo('/profile/interests') },
];

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
    // Before posts/:id, which would take "new" for an id.
    path: 'posts/new',
    component: AddPostView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('ADD_POST.title');
    },
  },
  {
    path: 'posts/:id/edit',
    component: EditPostView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('EDIT_POST.title');
    },
  },
  {
    path: 'posts/:id',
    component: FullPostView,
  },
  {
    path: 'profile/interests',
    component: InterestsView,
    canActivate: [authGuard],
    canDeactivate: [unsavedInterestsGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('INTERESTS.title');
    },
  },
  {
    path: 'profile/hidden',
    component: HiddenPostsView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('HIDDEN.title');
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
    path: 'users/:username',
    component: UserProfileView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('PROFILE.title');
    },
  },
  {
    path: 'people',
    component: DiscoverView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('DISCOVER.title');
    },
  },
  {
    path: 'plans',
    component: MyEventsView,
    canActivate: [authGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('MY_EVENTS.title');
    },
  },
  {
    path: 'auth/callback',
    component: AuthCallbackView,
  },
  ...MOVED_ROUTES,
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
