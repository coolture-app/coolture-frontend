import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { MOVED_ROUTES, routes } from './app.routes';

@Component({ template: '' })
class Page {}

describe('app routes', () => {
  const movedPaths = MOVED_ROUTES.map((route) => route.path);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          ...MOVED_ROUTES,
          { path: 'posts/new', component: Page },
          { path: 'posts/:id/edit', component: Page },
          { path: 'posts/:id', component: Page },
          { path: 'plans', component: Page },
          { path: 'users/:username', component: Page },
          { path: 'people', component: Page },
          { path: 'profile/interests', component: Page },
        ]),
      ],
    });
  });

  const moves: [string, string][] = [
    ['/post/p1', '/posts/p1'],
    ['/addPost', '/posts/new'],
    ['/editPost/p1', '/posts/p1/edit'],
    ['/myEvents', '/plans'],
    ['/u/ola', '/users/ola'],
    ['/discover', '/people'],
    ['/interests', '/profile/interests'],
  ];

  moves.forEach(([from, to]) => {
    it(`sends ${from} to ${to}`, async () => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl(from);
      expect(router.url).toBe(to);
    });
  });

  it('covers every moved path', () => {
    expect(moves.length).toBe(MOVED_ROUTES.length);
  });

  it('keeps the query string and fragment of a saved link', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/post/p1?from=mail#comments');
    expect(router.url).toBe('/posts/p1?from=mail#comments');
  });

  it('keeps a username that needs encoding', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/u/ola%20k');
    expect(router.url).toBe('/users/ola%20k');
  });

  it('has the new post page ahead of the post page, which would take "new" for an id', () => {
    const paths = routes.map((route) => route.path);
    expect(paths.indexOf('posts/new')).toBeLessThan(paths.indexOf('posts/:id'));
  });

  it('lists the moved paths ahead of the wildcard', () => {
    const paths = routes.map((route) => route.path);
    movedPaths.forEach((path) => expect(paths.indexOf(path)).toBeLessThan(paths.indexOf('**')));
  });
});
