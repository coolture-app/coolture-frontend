import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { NavigationEnd, provideRouter, Router, withRouterConfig } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { BackService } from './back.service';
import { OVERLAY_ENTRY } from '../back-closable/back-closable';

@Component({ template: '' })
class Page {}

describe('BackService', () => {
  let router: Router;
  let location: Location;
  let back: BackService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: '**', component: Page }],
          withRouterConfig({ canceledNavigationResolution: 'computed' }),
        ),
      ],
    });
    router = TestBed.inject(Router);
    // Done by the app's first navigation, which a test doesn't have.
    router.setUpLocationChangeListener();
    location = TestBed.inject(Location);
    back = TestBed.inject(BackService);
  });

  const visit = async (...urls: string[]) => {
    for (const url of urls) {
      await router.navigateByUrl(url);
    }
  };

  /** As the browser's Back or Forward: the router follows the pop after a task. */
  const pop = async (go: () => void) => {
    const arrived = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    go();
    await arrived;
  };

  /** As an overlay opens: its own entry, with the page's state. */
  const openOverlay = (url: string) =>
    location.go(url, '', { ...(location.getState() as object), [OVERLAY_ENTRY]: true });

  describe('names', () => {
    const cases: [string, object][] = [
      ['/', { key: 'MAIN_PAGE.forYou' }],
      ['/?tab=all&sort=popular', { key: 'MAIN_PAGE.all' }],
      ['/?tab=all&view=map', { key: 'MAIN_PAGE.map' }],
      ['/people', { key: 'PEOPLE.title' }],
      ['/plans', { key: 'PLANS.title' }],
      ['/profile', { key: 'PROFILE.title' }],
      ['/users/jan_demo', { text: '@jan_demo' }],
      ['/posts/p1', { key: 'BACK.post' }],
      ['/posts/p1#comments', { key: 'BACK.post' }],
      ['/profile/settings', { key: 'SETTINGS.title' }],
      ['/profile/blocked', { key: 'BLOCKED.title' }],
      ['/profile/hidden', { key: 'HIDDEN.title' }],
      ['/profile/interests', { key: 'INTERESTS.title' }],
      ['/posts/new', { key: 'ADD_POST.title' }],
      ['/posts/p1/edit', { key: 'EDIT_POST.title' }],
      ['/nowhere', { key: 'BACK.previous' }],
    ];
    for (const [url, label] of cases) {
      it(`${url}`, () => expect(back.target(url).label).toEqual(label as never));
    }

    it('a post by its title, once the post page knows it', () => {
      back.rememberPostTitle('p1', 'Koncert w parku');
      expect(back.target('/posts/p1').label).toEqual({ text: 'Koncert w parku' });
    });
  });

  it('names the page before', async () => {
    await visit('/?tab=all', '/posts/p1');

    expect(back.target('/')).toEqual({ url: '/?tab=all', label: { key: 'MAIN_PAGE.all' } });
  });

  it('keeps the page before right after Back and Forward', async () => {
    await visit('/', '/users/jan', '/posts/p1');

    await pop(() => location.back());
    expect(location.path()).toBe('/users/jan');
    expect(back.target('/people').url).toBe('/');

    await pop(() => location.forward());
    expect(back.target('/').url).toBe('/users/jan');
  });

  it('goes back in history to that page', async () => {
    await visit('/', '/users/jan', '/posts/p1');

    await pop(() => back.back('/'));

    expect(location.path()).toBe('/users/jan');
    expect(back.target('/people').url).toBe('/');
  });

  it('follows the home page as its filters replace the URL', async () => {
    await visit('/');
    await router.navigateByUrl('/?tab=all', { replaceUrl: true });
    await visit('/posts/p1');

    expect(back.target('/')).toEqual({ url: '/?tab=all', label: { key: 'MAIN_PAGE.all' } });
  });

  it('takes a link in the comments sheet as one Back from the page under the sheet', async () => {
    await visit('/plans');
    openOverlay('/posts/p1#comments');
    await router.navigateByUrl('/users/jan', { replaceUrl: true });

    expect(back.target('/people').url).toBe('/plans');
  });

  it('names an overlay with an address of its own, such as the map, when a link leaves it', async () => {
    await visit('/');
    openOverlay('/?view=map');
    await visit('/posts/p1');

    expect(back.target('/')).toEqual({ url: '/?view=map', label: { key: 'MAIN_PAGE.map' } });
  });

  it('keeps the page before when a page is replaced by another', async () => {
    await visit('/', '/posts/new');
    await router.navigateByUrl('/posts/p9', { replaceUrl: true });

    expect(back.target('/').url).toBe('/');
  });

  describe('with no page before in this tab', () => {
    it('names the fallback and goes there in place of this page', async () => {
      await visit('/users/jan');
      const historyBack = spyOn(location, 'back');

      expect(back.target('/people')).toEqual({ url: '/people', label: { key: 'PEOPLE.title' } });
      await pop(() => back.back('/people'));

      expect(historyBack).not.toHaveBeenCalled();
      expect(location.path()).toBe('/people');
      expect(back.target('/').url).toBe('/');
    });

    it('after a reload, whose entries came before it', async () => {
      location.replaceState('/posts/p1', '', { backEntry: 'old-1', ɵrouterPageId: 4 });
      await visit('/posts/p1');

      expect(back.target('/').url).toBe('/');
    });
  });
});
