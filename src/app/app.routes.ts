import { RedirectFunction, Route, Router, Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';
import { FullPostView } from './features/full-post-view/full-post-view';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { NotFoundView } from './features/not-found-view/not-found-view';
import { AddPostView } from './features/add-post-view/add-post-view';
import { DiscoverView } from './features/discover-view/discover-view';
import { UserProfileView } from './features/my-profile-view/my-profile-view';
import { signedIn } from './core/auth/auth.guard';
import { GuestView } from './features/guest-view/guest-view';
import { SignInReason } from './core/components/sign-in-card/sign-in-card';
import { EditPostView } from './features/edit-post-view/edit-post-view';
import { MyEventsView } from './features/my-events-view/my-events-view';
import { AuthCallbackView } from './features/auth-callback-view/auth-callback-view';
import { HiddenPostsView } from './features/hidden-posts-view/hidden-posts-view';
import { InterestsView, unsavedInterestsGuard } from './features/interests-view/interests-view';
import { SettingsView } from './features/settings-view/settings-view';
import { BlockedUsersView } from './features/blocked-users-view/blocked-users-view';

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

/**
 * A route for signed-in people, and its twin at the same path that tells a guest why to sign in. The twin is matched
 * when `signedIn` refuses, so the URL stays and the sign-in comes back to it.
 */
function needsSignIn(reason: SignInReason, route: Route): Routes {
  return [
    { ...route, canMatch: [signedIn] },
    { path: route.path, component: GuestView, data: { signIn: reason }, title: route.title },
  ];
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
  ...needsSignIn('addPost', {
    // Before posts/:id, which would take "new" for an id.
    path: 'posts/new',
    component: AddPostView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('ADD_POST.title');
    },
  }),
  ...needsSignIn('editPost', {
    path: 'posts/:id/edit',
    component: EditPostView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('EDIT_POST.title');
    },
  }),
  {
    path: 'posts/:id',
    component: FullPostView,
  },
  ...needsSignIn('interests', {
    path: 'profile/interests',
    component: InterestsView,
    canDeactivate: [unsavedInterestsGuard],
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('INTERESTS.title');
    },
  }),
  ...needsSignIn('settings', {
    path: 'profile/hidden',
    component: HiddenPostsView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('HIDDEN.title');
    },
  }),
  ...needsSignIn('settings', {
    path: 'profile/settings',
    component: SettingsView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('SETTINGS.title');
    },
  }),
  ...needsSignIn('settings', {
    path: 'profile/blocked',
    component: BlockedUsersView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('PROFILE.blocked');
    },
  }),
  ...needsSignIn('profile', {
    path: 'profile',
    component: UserProfileView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('PROFILE.title');
    },
  }),
  ...needsSignIn('user', {
    path: 'users/:username',
    component: UserProfileView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('PROFILE.title');
    },
  }),
  ...needsSignIn('people', {
    path: 'people',
    component: DiscoverView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('DISCOVER.title');
    },
  }),
  ...needsSignIn('plans', {
    path: 'plans',
    component: MyEventsView,
    title: () => {
      const translate = inject(TranslateService);
      return translate.get('MY_EVENTS.title');
    },
  }),
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
