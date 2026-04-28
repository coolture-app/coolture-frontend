import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'u/:username',
    renderMode: RenderMode.Server,
  },
  {
    path: 'editPost/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'post/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
