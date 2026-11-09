import { RenderMode, ServerRoute } from '@angular/ssr';
import { MOVED_ROUTES } from './app.routes';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'users/:username',
    renderMode: RenderMode.Server,
  },
  {
    path: 'posts/new',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'posts/:id/edit',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth/callback',
    renderMode: RenderMode.Client,
  },
  {
    path: 'profile/interests',
    renderMode: RenderMode.Client,
  },
  {
    path: 'posts/:id',
    renderMode: RenderMode.Server,
  },
  // A redirect function runs on request, so a moved path can't be prerendered.
  ...MOVED_ROUTES.map(({ path }) => ({ path: path!, renderMode: RenderMode.Server as const })),
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
