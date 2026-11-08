import { ViewportScroller } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Navigation, provideRouter, Router } from '@angular/router';

import { MainPage } from './main-page';
import { RESTORE_LIST_KEY } from './home-view';
import { LocationService } from '../../core/services/location/location.service';
import { PostService } from '../../core/services/post/post.service';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostCard } from '../../core/models/posts/post-card.model';
import { PostDetail } from '../../core/models/posts/post-detail.model';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { HomeTapService } from '../../core/services/home-tap/home-tap.service';

@Component({ template: '' })
class OtherPage {}

function card(id: string): PostCard {
  return {
    id,
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    title: `Post ${id}`,
    startsAt: '2026-12-01T18:00:00Z',
    tags: [],
    positiveReactionCount: 0,
    negativeReactionCount: 0,
    participantCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: '2026-11-01T00:00:00Z',
  };
}

function page(ids: string[] = []) {
  return { items: ids.map(card), page: { limit: 20, hasMore: false } };
}

describe('MainPage', () => {
  let fixture: ComponentFixture<MainPage>;
  let component: MainPage;
  let http: HttpTestingController;
  let router: Router;
  let allowedLocation: GeoPoint | null;
  let askedLocation: GeoPoint | null;
  let currentNavigation: jasmine.Spy;
  let locationRequest: Promise<GeoPoint | null> | null;
  let turnedOff: boolean;
  let scroller: ViewportScroller;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function open(navigation?: Partial<Navigation>): Promise<void> {
    currentNavigation.and.returnValue(navigation ?? null);
    fixture = TestBed.createComponent(MainPage);
    component = fixture.componentInstance;
    await settle();
    currentNavigation.and.returnValue(null);
  }

  /** Waits past the search debounce. */
  async function debounce(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 420));
    await settle();
  }

  function expectFeed(): TestRequest {
    return http.expectOne((r) => r.url.endsWith('/feed'));
  }

  function expectPosts(): TestRequest {
    return http.expectOne((r) => r.url.endsWith('/posts'));
  }

  function param(request: TestRequest, name: string): string | null {
    return request.request.params.get(name);
  }

  function shownTitles(): string[] {
    const titles = fixture.nativeElement.querySelectorAll('.post__title');
    return Array.from(titles as NodeListOf<Element>).map((title) => title.textContent!.trim());
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent!;
  }

  function button(label: string): HTMLButtonElement {
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLElement>;
    const found = Array.from(buttons).find((b) => b.textContent!.trim() === label);
    return found as HTMLButtonElement;
  }

  beforeEach(() => {
    allowedLocation = null;
    askedLocation = null;
    locationRequest = null;
    turnedOff = false;
    TestBed.configureTestingModule({
      imports: [MainPage],
      providers: [
        provideRouter([{ path: 'other', component: OtherPage }]),
        {
          provide: LocationService,
          useValue: {
            currentIfAllowed: () => Promise.resolve(allowedLocation),
            request: () => locationRequest ?? Promise.resolve(askedLocation),
            turnOff: () => (turnedOff = true),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    currentNavigation = spyOn(router, 'currentNavigation');
    scroller = TestBed.inject(ViewportScroller);
    spyOn(scroller, 'scrollToPosition');
  });

  afterEach(() => http.verify());

  describe('the flow between the feed and browsing', () => {
    it('opens on the feed, under Recommended', async () => {
      await open();

      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      expect(component.currentSortBy()).toBe('RECOMMENDED');
      expect(shownTitles()).toEqual(['Post a']);
    });

    it('offers Recommended to everyone, signed in or not', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      expect(component.authService.isAuthenticated()).toBeFalse();
      expect(component.sortOptions.map((o) => o.value)).toContain('RECOMMENDED');
    });

    it('moves to /posts, under Recent, when a search is typed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.searchControl.setValue('  jazz ');
      await debounce();

      const posts = expectPosts();
      expect(param(posts, 'q')).toBe('jazz');
      expect(param(posts, 'sortBy')).toBe('RECENT');
      expect(component.currentSortBy()).toBe('RECENT');
      posts.flush(page());
    });

    it('moves to /posts, under Recent, when a filter is set', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.filtersForm.controls.type.setValue('OFFLINE');
      await debounce();

      const posts = expectPosts();
      expect(param(posts, 'type')).toBe('OFFLINE');
      expect(param(posts, 'sortBy')).toBe('RECENT');
      posts.flush(page());
    });

    it('goes back to /feed when the search and filters are cleared', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      component.filtersForm.controls.tags.setValue('a, b');
      await debounce();
      const posts = expectPosts();
      expect(posts.request.params.getAll('tags')).toEqual(['a', 'b']);
      posts.flush(page());

      component.clearFilters();
      await settle();

      expectFeed().flush({ ...page(), mode: 'RANKED' });
      expect(component.currentSortBy()).toBe('RECOMMENDED');
    });

    it('goes back to /feed when a typed search is deleted', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      await debounce();
      expectPosts().flush(page());

      component.searchControl.setValue('');
      await debounce();

      expectFeed().flush({ ...page(), mode: 'RANKED' });
    });

    it('uses /posts with a sort picked by hand, and stays on it when the search is cleared', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.setSortBy('POPULAR');
      await settle();
      expect(param(expectPosts(), 'sortBy')).toBe('POPULAR');

      component.searchControl.setValue('jazz');
      await debounce();
      const searched = expectPosts();
      expect(param(searched, 'q')).toBe('jazz');
      expect(param(searched, 'sortBy')).toBe('POPULAR');
      searched.flush(page());

      component.clearFilters();
      await settle();
      const cleared = expectPosts();
      expect(param(cleared, 'q')).toBeNull();
      expect(param(cleared, 'sortBy')).toBe('POPULAR');
      expect(component.currentSortBy()).toBe('POPULAR');
      cleared.flush(page());
    });

    it('keeps a by-hand Recent even though Recent is also what a search shows', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setSortBy('RECENT');
      await settle();
      expectPosts().flush(page());

      component.clearFilters();
      await settle();

      expect(component.currentSortBy()).toBe('RECENT');
    });

    it('clears everything and goes to /feed when Recommended is picked', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setSortBy('UPCOMING');
      await settle();
      expectPosts().flush(page());
      component.searchControl.setValue('jazz');
      component.filtersForm.controls.includePast.setValue(true);
      await debounce();
      expectPosts().flush(page());

      component.setSortBy('RECOMMENDED');
      await settle();

      expectFeed().flush({ ...page(), mode: 'RANKED' });
      expect(component.searchControl.value).toBe('');
      expect(component.filtersForm.controls.includePast.value).toBeFalse();
    });

    it('goes to /feed when Recommended is picked from a sort with no search', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setSortBy('POPULAR');
      await settle();
      expectPosts().flush(page(['p']));

      component.setSortBy('RECOMMENDED');
      await settle();

      expectFeed().flush({ ...page(), mode: 'RANKED' });
      expect(component.currentSortBy()).toBe('RECOMMENDED');
    });

    it('never disables search or filters on the feed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      expect(component.searchControl.enabled).toBeTrue();
      expect(component.filtersForm.controls.type.enabled).toBeTrue();
    });

    it('does not start a new list when nothing about it changed', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      component.clearFilters();
      component.applyControls();
      component.setSortBy('RECOMMENDED');
      await settle();

      expect(shownTitles()).toEqual(['Post a']);
    });

    it('applies the search at once on Enter, without waiting for the debounce', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.searchControl.setValue('jazz');
      component.applyControls();
      await settle();

      expectPosts().flush(page());
      await debounce();
    });
  });

  describe('the map switch', () => {
    it('is there on the feed too', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(fixture.nativeElement.querySelector('app-switch.map-switch')).not.toBeNull();
    });

    it('passes the active filters on, and catches the list up when switched off', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      component.toggleMapView(true);
      await settle();
      component.searchControl.setValue('jazz');
      await debounce();

      expect(component.activeFilters()).toEqual({ q: 'jazz' });
      http.match((r) => r.url.endsWith('/posts/map'));
      http.expectNone((r) => r.url.endsWith('/posts'));

      component.toggleMapView(false);
      await settle();

      expect(param(expectPosts(), 'q')).toBe('jazz');
    });

    it('does not reload the list when nothing changed meanwhile', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      component.toggleMapView(true);
      await settle();
      component.toggleMapView(false);
      await settle();

      http.match((r) => r.url.endsWith('/posts/map'));
      expect(shownTitles()).toEqual(['Post a']);
    });
  });

  describe('past events', () => {
    it('sends includePast when the switch is on, also on the map filters', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.filtersForm.controls.includePast.setValue(true);
      await debounce();

      expect(param(expectPosts(), 'includePast')).toBe('true');
      expect(component.activeFilters()).toEqual({ includePast: true });
    });

    it('offers past events on an empty result in browse, and opens the filters', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      await debounce();
      expectPosts().flush(page());
      await settle();

      button('MAIN_PAGE.searchPast').click();
      await settle();

      const posts = expectPosts();
      expect(param(posts, 'q')).toBe('jazz');
      expect(param(posts, 'includePast')).toBe('true');
      expect(component.showFilters()).toBeTrue();
      posts.flush(page());
      await settle();
      expect(button('MAIN_PAGE.searchPast')).toBeUndefined();
    });

    it('does not offer them where it could not change anything', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();
      expect(button('MAIN_PAGE.searchPast')).toBeUndefined();

      component.setSortBy('UPCOMING');
      await settle();
      expectPosts().flush(page());
      await settle();
      expect(button('MAIN_PAGE.searchPast')).toBeUndefined();

      component.setSortBy('RECENT');
      component.filtersForm.controls.startsFrom.setValue('2026-01-01T10:00');
      await settle();
      http.match((r) => r.url.endsWith('/posts'));
      await debounce();
      expectPosts().flush(page());
      await settle();
      expect(button('MAIN_PAGE.searchPast')).toBeUndefined();
    });
  });

  describe('list states', () => {
    it('shows loading until the first page arrives, and not the empty message', async () => {
      await open();
      const request = expectFeed();
      await settle();

      expect(fixture.nativeElement.querySelectorAll('app-post-skeleton').length).toBe(3);
      expect(fixture.nativeElement.querySelector('[role=status]').getAttribute('aria-label')).toBe(
        'MAIN_PAGE.loading',
      );
      expect(text()).not.toContain('MAIN_PAGE.no-posts');

      request.flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(fixture.nativeElement.querySelector('app-post-skeleton')).toBeNull();
      expect(text()).toContain('MAIN_PAGE.no-posts');
    });

    it('shows one placeholder, not a screenful, while adding to a list', async () => {
      await open();
      expectFeed().flush({
        ...page(['a']),
        mode: 'RANKED',
        page: { limit: 20, hasMore: true, nextCursor: 'c1' },
      });
      await settle();

      component.list.loadMore();
      await settle();

      expect(fixture.nativeElement.querySelectorAll('app-post-skeleton').length).toBe(1);
      expect(shownTitles()).toEqual(['Post a']);
      expectFeed().flush({ ...page(['b']), mode: 'RANKED' });
    });

    it('asks for the next page from 15 cards before the end, on any screen', async () => {
      const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
      await open();
      expectFeed().flush({
        ...page(ids),
        mode: 'RANKED',
        page: { limit: 20, hasMore: true, nextCursor: 'c1' },
      });
      await settle();

      const triggers = fixture.nativeElement.querySelectorAll('.list-trigger');
      expect(triggers.length).toBe(1);
      expect(triggers[0].nextElementSibling.querySelector('.post__title').textContent.trim()).toBe(
        'Post c5',
      );
    });

    it('also asks from after the last card, for a jump straight to the bottom', async () => {
      const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
      await open();
      expectFeed().flush({
        ...page(ids),
        mode: 'RANKED',
        page: { limit: 20, hasMore: true, nextCursor: 'c1' },
      });
      await settle();

      const end = fixture.nativeElement.querySelector('.list-end');
      expect(end.previousElementSibling.querySelector('.post__title').textContent.trim()).toBe(
        'Post c19',
      );
      spyOn(component.list, 'loadMore');
      const directive = fixture.debugElement
        .queryAll((el) => el.nativeElement === end)[0]
        .injector.get(InfiniteScroll);
      expect(directive.enabled()).toBeTrue();
      directive.reachedEnd.emit();
      expect(component.list.loadMore).toHaveBeenCalled();
    });

    it('asks straight away when a short page leaves fewer cards than that', async () => {
      await open();
      expectFeed().flush({
        ...page(['a', 'b']),
        mode: 'RANKED',
        page: { limit: 20, hasMore: true, nextCursor: 'c1' },
      });
      await settle();

      const trigger = fixture.nativeElement.querySelector('.list-trigger');
      expect(trigger.nextElementSibling.querySelector('.post__title').textContent.trim()).toBe(
        'Post a',
      );
    });

    it('shows the end of the list only after posts', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      expect(text()).toContain('MAIN_PAGE.endOfList');
    });

    it('offers a retry on a failure, keeping the posts, and retrying works', async () => {
      await open();
      expectFeed().flush({
        ...page(['a']),
        mode: 'RANKED',
        page: { limit: 20, hasMore: true, nextCursor: 'c1' },
      });
      await settle();

      component.list.loadMore();
      expectFeed().flush({ error: 'down' }, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(text()).toContain('MAIN_PAGE.loadError');
      expect(shownTitles()).toEqual(['Post a']);

      button('MAIN_PAGE.retry').click();
      const retried = expectFeed();
      expect(param(retried, 'cursor')).toBe('c1');
      retried.flush({ ...page(['b']), mode: 'RANKED' });
      await settle();

      expect(shownTitles()).toEqual(['Post a', 'Post b']);
    });
  });

  describe('Home tapped at the top', () => {
    it('starts a new feed session, keeping the location', async () => {
      allowedLocation = { latitude: 54.35, longitude: 18.65 };
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      TestBed.inject(HomeTapService).freshFeed.next();
      await settle();

      const again = expectFeed();
      expect(param(again, 'latitude')).toBe('54.35');
      expect(param(again, 'cursor')).toBeNull();
      again.flush({ ...page(['b']), mode: 'RANKED' });
      await settle();
      expect(shownTitles()).toEqual(['Post b']);
    });

    it('leaves a search for the default feed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      component.applyControls();
      await settle();
      expectPosts().flush(page(['j']));

      TestBed.inject(HomeTapService).freshFeed.next();
      await settle();

      expectFeed().flush({ ...page(['f']), mode: 'RANKED' });
      await settle();
      expect(component.searchControl.value).toBe('');
      expect(component.currentSortBy()).toBe('RECOMMENDED');
      expect(shownTitles()).toEqual(['Post f']);
    });
  });

  describe('location', () => {
    it('uses the position when already allowed', async () => {
      allowedLocation = { latitude: 54.35, longitude: 18.65 };
      await open();

      const request = expectFeed();
      expect(param(request, 'latitude')).toBe('54.35');
      expect(param(request, 'longitude')).toBe('18.65');
      request.flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(component.isNearMe()).toBeTrue();
    });

    it('starts a new session with the position when the button is tapped and allowed', async () => {
      await open();
      const first = expectFeed();
      expect(param(first, 'latitude')).toBeNull();
      first.flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      askedLocation = { latitude: 54.35, longitude: 18.65 };
      await component.toggleNearMe();

      const second = expectFeed();
      expect(param(second, 'latitude')).toBe('54.35');
      second.flush({ ...page(), mode: 'RANKED' });
    });

    it('leaves the feed as it is when refused, and says so', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      await component.toggleNearMe();
      await settle();

      expect(shownTitles()).toEqual(['Post a']);
      expect(text()).toContain('MAIN_PAGE.locationFailed');
      expect(component.isNearMe()).toBeFalse();
    });

    it('turns off again on a second tap, with a new session and no location', async () => {
      allowedLocation = { latitude: 54.35, longitude: 18.65 };
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();
      expect(component.isNearMe()).toBeTrue();

      await component.toggleNearMe();

      const off = expectFeed();
      expect(param(off, 'latitude')).toBeNull();
      expect(turnedOff).toBeTrue();
      expect(component.isNearMe()).toBeFalse();
      off.flush({ ...page(['b']), mode: 'RANKED' });
    });

    it('ignores taps while it is still waiting for the position', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();
      let answer: (location: GeoPoint) => void = () => undefined;
      locationRequest = new Promise((resolve) => (answer = resolve));

      const first = component.toggleNearMe();
      expect(component.locating()).toBeTrue();
      await component.toggleNearMe();
      await component.toggleNearMe();
      answer({ latitude: 54.35, longitude: 18.65 });
      await first;

      const request = expectFeed();
      expect(param(request, 'latitude')).toBe('54.35');
      expect(component.locating()).toBeFalse();
      request.flush({ ...page(), mode: 'RANKED' });
    });

    it('clears the note about a refusal on the next tap', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();
      await component.toggleNearMe();
      expect(component.locationFailed()).toBeTrue();

      askedLocation = { latitude: 54.35, longitude: 18.65 };
      await component.toggleNearMe();

      expect(component.locationFailed()).toBeFalse();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
    });

    it('shows the button only on the feed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();
      expect(button('MAIN_PAGE.nearMe')).toBeDefined();

      component.setSortBy('POPULAR');
      await settle();
      expectPosts().flush(page());
      await settle();
      expect(button('MAIN_PAGE.nearMe')).toBeUndefined();
    });
  });

  describe('coming back to the list', () => {
    async function leaveAfterScrolling(): Promise<void> {
      spyOn(scroller, 'getScrollPosition').and.returnValue([0, 1234]);
      await router.navigateByUrl('/other');
      fixture.destroy();
    }

    async function comeBack(navigation: Partial<Navigation>): Promise<void> {
      currentNavigation.and.returnValue(navigation);
      fixture = TestBed.createComponent(MainPage);
      component = fixture.componentInstance;
      await settle();
    }

    beforeEach(async () => {
      await open();
      expectFeed().flush({ ...page(['a', 'b']), mode: 'RANKED' });
      await settle();
    });

    it('restores list and position with no request, on the browser Back', async () => {
      await leaveAfterScrolling();

      await comeBack({ trigger: 'popstate', extras: {} });

      expect(shownTitles()).toEqual(['Post a', 'Post b']);
      expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 1234]);
    });

    it("does the same for the post page's own back button", async () => {
      await leaveAfterScrolling();

      await comeBack({ trigger: 'imperative', extras: { state: { [RESTORE_LIST_KEY]: true } } });

      expect(shownTitles()).toEqual(['Post a', 'Post b']);
    });

    it('restores the search, the filters and the chosen sort', async () => {
      component.setSortBy('POPULAR');
      await settle();
      expectPosts().flush(page());
      component.searchControl.setValue('jazz');
      component.filtersForm.controls.includePast.setValue(true);
      component.toggleFilters();
      await debounce();
      expectPosts().flush(page(['c']));
      await settle();
      await leaveAfterScrolling();

      await comeBack({ trigger: 'popstate', extras: {} });

      expect(component.searchControl.value).toBe('jazz');
      expect(component.filtersForm.controls.includePast.value).toBeTrue();
      expect(component.showFilters()).toBeTrue();
      expect(component.currentSortBy()).toBe('POPULAR');
      expect(shownTitles()).toEqual(['Post c']);
      await debounce();
    });

    it('shows on the card what happened on the post page', async () => {
      await leaveAfterScrolling();
      TestBed.inject(PostService).setActivePost({
        ...card('a'),
        title: 'Edited',
        commentsCount: 5,
        myReaction: 'LIKE',
        media: [],
      } as PostDetail);

      await comeBack({ trigger: 'popstate', extras: {} });

      expect(shownTitles()).toEqual(['Edited', 'Post b']);
      expect(component.list.items()[0].myReaction).toBe('LIKE');
      expect(TestBed.inject(PostService).activePost()).toBeNull();
    });

    it('starts a new session on any other navigation', async () => {
      await leaveAfterScrolling();

      await comeBack({ trigger: 'imperative', extras: {} });

      expectFeed().flush({ ...page(['z']), mode: 'RANKED' });
      await settle();
      expect(shownTitles()).toEqual(['Post z']);
    });

    it('starts a new session when coming back after more than 30 minutes', async () => {
      await leaveAfterScrolling();
      const later = Date.now() + 31 * 60 * 1000;
      spyOn(Date, 'now').and.returnValue(later);

      await comeBack({ trigger: 'popstate', extras: {} });

      expectFeed().flush({ ...page(['z']), mode: 'RANKED' });
      await settle();
      expect(shownTitles()).toEqual(['Post z']);
    });

    it('opens the next page at the top, unless going back', async () => {
      (scroller.scrollToPosition as jasmine.Spy).calls.reset();

      await leaveAfterScrolling();

      expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 0]);
    });
  });
});
