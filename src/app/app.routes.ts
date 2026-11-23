import { RedirectFunction, Route, Router, Routes } from '@angular/router';
import { MainPage } from './features/main-page/main-page';
import { FullPostView } from './features/full-post-view/full-post-view';
import { TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { NotFoundView } from './features/not-found-view/not-found-view';
import { AddPostView } from './features/add-post-view/add-post-view';
import { PeopleView } from './features/people-view/people-view';
import { ProfileView } from './features/profile-view/profile-view';
import { signedIn } from './core/auth/auth.guard';
import { GuestView } from './features/guest-view/guest-view';
import { SignInReason } from './core/models/common/sign-in-reason';
import { EditPostView } from './features/edit-post-view/edit-post-view';
import { PlansView } from './features/plans-view/plans-view';
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

const titled = (key: string) => () => inject(TranslateService).get(key);

export const routes: Routes = [
  {
    path: '',
    component: MainPage,
    title: titled('MAIN_PAGE.title'),
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
    title: titled('ADD_POST.title'),
  }),
  ...needsSignIn('editPost', {
    path: 'posts/:id/edit',
    component: EditPostView,
    title: titled('EDIT_POST.title'),
  }),
  {
    path: 'posts/:id',
    component: FullPostView,
  },
  ...needsSignIn('interests', {
    path: 'profile/interests',
    component: InterestsView,
    canDeactivate: [unsavedInterestsGuard],
    title: titled('INTERESTS.title'),
  }),
  ...needsSignIn('settings', {
    path: 'profile/hidden',
    component: HiddenPostsView,
    title: titled('HIDDEN.title'),
  }),
  ...needsSignIn('settings', {
    path: 'profile/settings',
    component: SettingsView,
    title: titled('SETTINGS.title'),
  }),
  ...needsSignIn('settings', {
    path: 'profile/blocked',
    component: BlockedUsersView,
    title: titled('BLOCKED.title'),
  }),
  ...needsSignIn('profile', {
    path: 'profile',
    component: ProfileView,
    title: titled('PROFILE.title'),
  }),
  ...needsSignIn('user', {
    path: 'users/:username',
    component: ProfileView,
    title: titled('PROFILE.title'),
  }),
  ...needsSignIn('people', {
    path: 'people',
    component: PeopleView,
    title: titled('PEOPLE.title'),
  }),
  ...needsSignIn('plans', {
    path: 'plans',
    component: PlansView,
    title: titled('PLANS.title'),
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
    title: titled('404.title'),
  },
];
