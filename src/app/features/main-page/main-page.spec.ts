import { ViewportScroller } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Navigation, provideRouter, Router } from '@angular/router';

import { MainPage } from './main-page';
import { LocationService } from '../../core/services/location/location.service';
import { PostService } from '../../core/services/post/post.service';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostCard } from '../../core/models/posts/post-card.model';
import { PostDetail } from '../../core/models/posts/post-detail.model';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { HomeTapService } from '../../core/services/home-tap/home-tap.service';
import { ToastService } from '../../core/services/toast/toast.service';

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
    TestBed.configureTestingModule({
      imports: [MainPage],
      providers: [
        provideRouter([{ path: 'other', component: OtherPage }]),
        {
          provide: LocationService,
          useValue: {
            currentIfAllowed: () => Promise.resolve(allowedLocation),
            currentOrAsk: () => Promise.resolve(allowedLocation),
            request: () => locationRequest ?? Promise.resolve(askedLocation),
            measureFrom: () => undefined,
            metersTo: () => null,
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

  describe('the two tabs', () => {
    it('opens on Dla Ciebie, the feed', async () => {
      await open();

      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      expect(component.tab()).toBe('forYou');
      expect(shownTitles()).toEqual(['Post a']);
    });

    it('narrows Dla Ciebie with a search, and stays on the feed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.searchControl.setValue('  jazz ');
      await debounce();

      const feed = expectFeed();
      expect(param(feed, 'q')).toBe('jazz');
      expect(component.tab()).toBe('forYou');
      feed.flush({ ...page(), mode: 'RANKED' });
    });

    it('narrows Dla Ciebie with filters, sent again with every page', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.filtersForm.controls.type.setValue('OFFLINE');
      component.filtersForm.controls.tags.setValue('a, b');
      await debounce();

      const first = expectFeed();
      expect(param(first, 'type')).toBe('OFFLINE');
      expect(first.request.params.getAll('tags')).toEqual(['a', 'b']);
      first.flush({
        items: [card('a')],
        page: { limit: 20, hasMore: true, nextCursor: 'c1' },
        mode: 'RANKED',
      });
      await settle();

      component.list.loadMore();
      const next = expectFeed();
      expect(param(next, 'cursor')).toBe('c1');
      expect(param(next, 'type')).toBe('OFFLINE');
      next.flush({ ...page(), mode: 'RANKED' });
    });

    it('shows Wszystkie as every post, coming up next first, with the same search', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      await debounce();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.setTab('all');
      await settle();

      const posts = expectPosts();
      expect(param(posts, 'q')).toBe('jazz');
      expect(param(posts, 'sortBy')).toBe('UPCOMING');
      posts.flush(page());
    });

    it('keeps the sort when filters change on Wszystkie, and keeps the filters when the sort changes', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setTab('all');
      await settle();
      expectPosts().flush(page());

      await component.setSortBy('POPULAR');
      await settle();
      expect(param(expectPosts(), 'sortBy')).toBe('POPULAR');

      component.filtersForm.controls.type.setValue('ONLINE');
      await debounce();
      const filtered = expectPosts();
      expect(param(filtered, 'sortBy')).toBe('POPULAR');
      expect(param(filtered, 'type')).toBe('ONLINE');
      filtered.flush(page());

      await component.setSortBy('RECENT');
      await settle();
      const resorted = expectPosts();
      expect(param(resorted, 'type')).toBe('ONLINE');
      resorted.flush(page());
    });

    it('shows the sort menu only on Wszystkie', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();
      expect(fixture.nativeElement.querySelector('.sort-wrapper')).toBeNull();

      component.setTab('all');
      await settle();
      expectPosts().flush(page());
      await settle();

      expect(fixture.nativeElement.querySelector('.sort-wrapper')).not.toBeNull();
      expect(component.sortOptions.map((o) => o.value)).toEqual([
        'UPCOMING',
        'NEAREST',
        'POPULAR',
        'RECENT',
      ]);
    });

    it('goes back to the feed, with its filters, on Dla Ciebie', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setTab('all');
      await settle();
      expectPosts().flush(page());
      component.filtersForm.controls.includePast.setValue(true);
      await debounce();
      expectPosts().flush(page());

      component.setTab('forYou');
      await settle();

      expect(param(expectFeed(), 'includePast')).toBe('true');
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
      component.setTab('forYou');
      await settle();

      expect(shownTitles()).toEqual(['Post a']);
    });

    it('applies the search at once on Enter, without waiting for the debounce', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.searchControl.setValue('jazz');
      component.applyControls();
      await settle();

      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await debounce();
    });

    it('points a search on Dla Ciebie to Wszystkie, at the end of its results', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      await debounce();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      expect(text()).toContain('MAIN_PAGE.seenBefore');
      button('MAIN_PAGE.showInAll').click();
      await settle();

      expect(component.tab()).toBe('all');
      expect(param(expectPosts(), 'q')).toBe('jazz');
    });

    it('does not point to Wszystkie without a search', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();

      expect(text()).not.toContain('MAIN_PAGE.seenBefore');
    });
  });

  describe('Najbliższe', () => {
    it('sends the position with the sort', async () => {
      askedLocation = { latitude: 54.35, longitude: 18.65 };
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setTab('all');
      await settle();
      expectPosts().flush(page());

      await component.setSortBy('NEAREST');
      await settle();

      const posts = expectPosts();
      expect(param(posts, 'sortBy')).toBe('NEAREST');
      expect(param(posts, 'latitude')).toBe('54.35');
      expect(param(posts, 'longitude')).toBe('18.65');
      expect(param(posts, 'radiusKm')).toBeNull();
      posts.flush(page());
    });

    it('keeps the order and says why when the position is refused', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setTab('all');
      await settle();
      expectPosts().flush(page());

      await component.setSortBy('NEAREST');
      await settle();

      http.expectNone((r) => r.url.endsWith('/posts'));
      expect(component.sort()).toBe('UPCOMING');
      expect(TestBed.inject(ToastService).message()).toBe('MAIN_PAGE.nearestNeedsLocation');
    });
  });

  describe('the bar above the feed', () => {
    it('clears the search with its own button, at once', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      component.applyControls();
      await settle();
      expectFeed().flush({ ...page(['j']), mode: 'RANKED' });
      await settle();

      (fixture.nativeElement.querySelector('.searchbar__clear') as HTMLButtonElement).click();
      await settle();

      expectFeed().flush({ ...page(['f']), mode: 'RANKED' });
      await settle();
      expect(component.searchControl.value).toBe('');
      expect(fixture.nativeElement.querySelector('.searchbar__clear')).toBeNull();
    });

    it('counts the filters that are on, a date range as one, and not the search', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz', { emitEvent: false });
      component.filtersForm.patchValue(
        { type: 'OFFLINE', startsFrom: '2026-12-01T10:00', startsTo: '2026-12-02T10:00' },
        { emitEvent: false },
      );
      component.applyControls();
      await settle();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(component.activeFilterCount()).toBe(2);
      const count = fixture.nativeElement.querySelector('.filters-btn__count');
      expect(count.textContent.trim()).toBe('2');
    });

    it('starts a changed list at the top', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      (scroller.scrollToPosition as jasmine.Spy).calls.reset();

      component.setTab('all');
      await settle();

      expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 0]);
      expectPosts().flush(page());
    });

    it('hides while scrolling down past the top and comes back on any scroll up', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      let y = 0;
      spyOnProperty(window, 'scrollY').and.callFake(() => y);
      const scrollTo = (to: number) => {
        y = to;
        component.onScroll();
      };

      scrollTo(60);
      expect(component.barHidden()).toBeFalse();
      scrollTo(400);
      expect(component.barHidden()).toBeTrue();
      scrollTo(395);
      expect(component.barHidden()).toBeFalse();
      expect(component.scrolling()).toBeTrue();
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(component.scrolling()).toBeTrue();
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(component.scrolling()).toBeFalse();
    });
  });

  describe('the map switch', () => {
    it('is there on the feed too', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      const options = fixture.nativeElement.querySelectorAll('.view-switch__option');
      expect(Array.from(options as NodeListOf<Element>).map((o) => o.textContent!.trim())).toEqual([
        'MAIN_PAGE.list',
        'MAIN_PAGE.map',
      ]);
      expect(options[0].getAttribute('aria-pressed')).toBe('true');
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

      expect(param(expectFeed(), 'q')).toBe('jazz');
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

    it('puts the list back where it was scrolled to', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();
      spyOn(scroller, 'getScrollPosition').and.returnValue([0, 1234]);

      component.toggleMapView(true);
      await settle();
      (scroller.getScrollPosition as jasmine.Spy).and.returnValue([0, 0]);
      component.toggleMapView(false);
      await settle();

      http.match((r) => r.url.endsWith('/posts/map'));
      expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 1234]);
    });

    it('starts a list that changed on the map at the top', async () => {
      await open();
      expectFeed().flush({ ...page(['a']), mode: 'RANKED' });
      await settle();
      spyOn(scroller, 'getScrollPosition').and.returnValue([0, 1234]);

      component.toggleMapView(true);
      await settle();
      component.searchControl.setValue('jazz');
      await debounce();
      component.toggleMapView(false);
      await settle();

      http.match((r) => r.url.endsWith('/posts/map'));
      expectFeed();
      expect(scroller.scrollToPosition).not.toHaveBeenCalledWith([0, 1234]);
    });
  });

  describe('past events', () => {
    it('sends includePast when the switch is on, also on the map filters', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });

      component.filtersForm.controls.includePast.setValue(true);
      await debounce();

      expect(param(expectFeed(), 'includePast')).toBe('true');
      expect(component.activeFilters()).toEqual({ includePast: true });
    });

    it('offers past events on an empty result, and opens the filters', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.searchControl.setValue('jazz');
      await debounce();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      button('MAIN_PAGE.searchPast').click();
      await settle();

      const feed = expectFeed();
      expect(param(feed, 'q')).toBe('jazz');
      expect(param(feed, 'includePast')).toBe('true');
      expect(component.showFilters()).toBeTrue();
      feed.flush({ ...page(), mode: 'RANKED' });
      await settle();
      expect(button('MAIN_PAGE.searchPast')).toBeUndefined();
    });

    it('does not offer them where it could not change anything', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      // Wszystkie starts on Nadchodzące, which never shows ended events.
      component.setTab('all');
      await settle();
      expectPosts().flush(page());
      await settle();
      expect(button('MAIN_PAGE.searchPast')).toBeUndefined();

      void component.setSortBy('RECENT');
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

    it('leaves a search, and Wszystkie, for the default feed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.setTab('all');
      await settle();
      expectPosts().flush(page());
      component.searchControl.setValue('jazz');
      component.applyControls();
      await settle();
      expectPosts().flush(page(['j']));

      TestBed.inject(HomeTapService).freshFeed.next();
      await settle();

      const feed = expectFeed();
      expect(param(feed, 'q')).toBeNull();
      feed.flush({ ...page(['f']), mode: 'RANKED' });
      await settle();
      expect(component.searchControl.value).toBe('');
      expect(component.tab()).toBe('forYou');
      expect(shownTitles()).toEqual(['Post f']);
    });
  });

  describe('location', () => {
    it('uses the position on the first page when it is allowed, or once asked', async () => {
      allowedLocation = { latitude: 54.35, longitude: 18.65 };
      await open();

      const request = expectFeed();
      expect(param(request, 'latitude')).toBe('54.35');
      expect(param(request, 'longitude')).toBe('18.65');
      request.flush({ ...page(), mode: 'RANKED' });
    });

    it('offers no Near me button any more', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(text()).not.toContain('MAIN_PAGE.nearMe');
    });

    describe('the filter', () => {
      async function openFilters(): Promise<void> {
        await open();
        expectFeed().flush({ ...page(), mode: 'RANKED' });
        component.toggleFilters();
        await settle();
      }

      function chip(label: string): HTMLButtonElement {
        const chips = fixture.nativeElement.querySelectorAll('.chip') as NodeListOf<HTMLElement>;
        return Array.from(chips).find((c) => c.textContent!.trim() === label) as HTMLButtonElement;
      }

      it('starts at Anywhere, with no radius to pick', async () => {
        await openFilters();

        expect(chip('MAIN_PAGE.anywhere').getAttribute('aria-pressed')).toBe('true');
        expect(fixture.nativeElement.querySelectorAll('.chip--small').length).toBe(0);
      });

      it('lists posts within 5 km of the position by default', async () => {
        askedLocation = { latitude: 54.35, longitude: 18.65 };
        await openFilters();

        chip('MAIN_PAGE.myLocation').click();
        await debounce();

        const feed = expectFeed();
        expect(param(feed, 'latitude')).toBe('54.35');
        expect(param(feed, 'longitude')).toBe('18.65');
        expect(param(feed, 'radiusKm')).toBe('5');
        feed.flush({
          items: [card('a')],
          page: { limit: 20, hasMore: true, nextCursor: 'c1' },
          mode: 'RANKED',
        });
        await settle();
        component.list.loadMore();
        const next = expectFeed();
        expect(param(next, 'radiusKm')).toBe('5');
        expect(param(next, 'latitude')).toBe('54.35');
        next.flush({ ...page(), mode: 'RANKED' });
        await settle();
        expect(component.activeFilterCount()).toBe(1);
        const radii = fixture.nativeElement.querySelectorAll('.chip--small');
        expect(Array.from(radii as NodeListOf<Element>).map((c) => c.textContent!.trim())).toEqual(
          Array(6).fill('MAIN_PAGE.km'),
        );
      });

      it('changes the radius', async () => {
        askedLocation = { latitude: 54.35, longitude: 18.65 };
        await openFilters();
        chip('MAIN_PAGE.myLocation').click();
        await debounce();
        expectFeed().flush({ ...page(), mode: 'RANKED' });
        await settle();

        (fixture.nativeElement.querySelectorAll('.chip--small')[4] as HTMLButtonElement).click();
        await debounce();

        expect(param(expectFeed(), 'radiusKm')).toBe('50');
      });

      it('offers the next radius when nothing is inside, and none past the largest', async () => {
        askedLocation = { latitude: 54.35, longitude: 18.65 };
        await openFilters();
        chip('MAIN_PAGE.myLocation').click();
        await debounce();
        expectFeed().flush({ ...page(), mode: 'RANKED' });
        await settle();

        button('MAIN_PAGE.widenRadius').click();
        await settle();

        expect(param(expectFeed(), 'radiusKm')).toBe('10');
        expect(component.filtersForm.controls.radiusKm.value).toBe(10);

        component.filtersForm.controls.radiusKm.setValue(100);
        await debounce();
        expectFeed().flush({ ...page(), mode: 'RANKED' });
        await settle();
        expect(button('MAIN_PAGE.widenRadius')).toBeUndefined();
      });

      it('goes back to Anywhere and says why when the position is refused', async () => {
        await openFilters();

        chip('MAIN_PAGE.myLocation').click();
        await debounce();

        expect(component.filtersForm.controls.place.value).toBe('');
        expect(text()).toContain('MAIN_PAGE.locationFailed');
      });

      it('shows that it is waiting for the position', async () => {
        let answer: (location: GeoPoint) => void = () => undefined;
        locationRequest = new Promise((resolve) => (answer = resolve));
        await openFilters();

        chip('MAIN_PAGE.myLocation').click();
        await settle();
        expect(component.locating()).toBeTrue();

        answer({ latitude: 54.35, longitude: 18.65 });
        await debounce();
        expect(component.locating()).toBeFalse();
        expect(param(expectFeed(), 'radiusKm')).toBe('5');
      });
    });

    it('closes the panel on Escape, and on Done', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.toggleFilters();
      await settle();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(component.showFilters()).toBeFalse();

      component.toggleFilters();
      await settle();
      button('MAIN_PAGE.done').click();
      await settle();
      expect(component.showFilters()).toBeFalse();
    });
  });

  describe('the URL', () => {
    function chip(label: string): HTMLButtonElement {
      const chips = fixture.nativeElement.querySelectorAll('.chip') as NodeListOf<HTMLElement>;
      return Array.from(chips).find((c) => c.textContent!.trim() === label) as HTMLButtonElement;
    }

    it('stays a plain / on the default feed', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(router.url).toBe('/');
    });

    it('shows the search, tab and sort, and replaces the entry so Back leaves the page', async () => {
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      const navigate = spyOn(router, 'navigate').and.callThrough();

      component.setTab('all');
      await settle();
      expectPosts().flush(page());
      await component.setSortBy('POPULAR');
      await settle();
      expectPosts().flush(page());
      component.searchControl.setValue('jazz');
      await debounce();
      expectPosts().flush(page());
      await settle();

      expect(router.url).toBe('/?tab=all&sort=popular&q=jazz');
      navigate.calls.allArgs().forEach(([, extras]) => expect(extras?.replaceUrl).toBeTrue());
    });

    it('opens with what the URL holds', async () => {
      await router.navigateByUrl('/?tab=all&sort=popular&q=jazz&type=offline&past=true');

      await open();

      const posts = expectPosts();
      expect(param(posts, 'sortBy')).toBe('POPULAR');
      expect(param(posts, 'q')).toBe('jazz');
      expect(param(posts, 'type')).toBe('OFFLINE');
      expect(param(posts, 'includePast')).toBe('true');
      expect(component.tab()).toBe('all');
      expect(component.searchControl.value).toBe('jazz');
      expect(component.activeFilterCount()).toBe(2);
      posts.flush(page());
    });

    it('clears a value it can’t use from the URL', async () => {
      await router.navigateByUrl('/?sort=nope&radius=7');

      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(router.url).toBe('/');
    });

    it('offers a linked place as Wskazane miejsce, and lists around it', async () => {
      await router.navigateByUrl('/?radius=25&lat=54.35&lng=18.65');

      await open();

      const feed = expectFeed();
      expect(param(feed, 'latitude')).toBe('54.35');
      expect(param(feed, 'longitude')).toBe('18.65');
      expect(param(feed, 'radiusKm')).toBe('25');
      feed.flush({ ...page(), mode: 'RANKED' });
      component.toggleFilters();
      await settle();
      expect(chip('MAIN_PAGE.pickedPlace').getAttribute('aria-pressed')).toBe('true');
      expect(chip('MAIN_PAGE.myLocation').getAttribute('aria-pressed')).toBe('false');
    });

    it('moves from a linked place to the user’s own position, and shows that in the URL', async () => {
      askedLocation = { latitude: 50.06, longitude: 19.94 };
      await router.navigateByUrl('/?radius=25&lat=54.35&lng=18.65');
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.toggleFilters();
      await settle();

      chip('MAIN_PAGE.myLocation').click();
      await debounce();

      const feed = expectFeed();
      expect(param(feed, 'latitude')).toBe('50.06');
      feed.flush({ ...page(), mode: 'RANKED' });
      await settle();
      expect(router.url).toBe('/?radius=25&lat=50.06&lng=19.94');
      expect(chip('MAIN_PAGE.pickedPlace')).toBeDefined();
    });

    it('has no Wskazane miejsce without a linked place, and clearing removes it', async () => {
      await router.navigateByUrl('/?radius=25&lat=54.35&lng=18.65');
      await open();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      component.toggleFilters();
      await settle();

      component.clearFilters();
      await settle();
      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();

      expect(chip('MAIN_PAGE.pickedPlace')).toBeUndefined();
      expect(router.url).toBe('/');
    });

    it('sorts Najbliższe from the linked point', async () => {
      await router.navigateByUrl('/?tab=all&sort=nearest&lat=54.35&lng=18.65');

      await open();

      const posts = expectPosts();
      expect(param(posts, 'sortBy')).toBe('NEAREST');
      expect(param(posts, 'latitude')).toBe('54.35');
      posts.flush(page());
    });

    it('falls back when a link asks for Najbliższe and no position comes', async () => {
      await router.navigateByUrl('/?tab=all&sort=nearest');

      await open();

      const posts = expectPosts();
      expect(param(posts, 'sortBy')).toBe('UPCOMING');
      posts.flush(page());
      await settle();
      expect(router.url).toBe('/?tab=all');
      expect(TestBed.inject(ToastService).message()).toBe('MAIN_PAGE.nearestNeedsLocation');
    });

    it('goes back to a plain / when Home starts a fresh feed', async () => {
      await router.navigateByUrl('/?tab=all&q=jazz');
      await open();
      expectPosts().flush(page());
      await settle();

      TestBed.inject(HomeTapService).freshFeed.next();
      await settle();

      expectFeed().flush({ ...page(), mode: 'RANKED' });
      await settle();
      expect(router.url).toBe('/');
    });
  });

  describe('coming back to the list', () => {
    let homeUrl = '/';

    async function leaveAfterScrolling(): Promise<void> {
      homeUrl = router.url;
      await router.navigateByUrl('/other');
      fixture.destroy();
    }

    async function comeBack(navigation: Partial<Navigation>): Promise<void> {
      await router.navigateByUrl(homeUrl);
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

    it('restores the list at once with no request on Back, and leaves the scroll to the router', async () => {
      await leaveAfterScrolling();
      (scroller.scrollToPosition as jasmine.Spy).calls.reset();

      await comeBack({ trigger: 'popstate', extras: {} });

      expect(shownTitles()).toEqual(['Post a', 'Post b']);
      expect(scroller.scrollToPosition).not.toHaveBeenCalled();
    });

    it('restores the tab, the search, the filters and the chosen sort', async () => {
      component.setTab('all');
      await settle();
      expectPosts().flush(page());
      await component.setSortBy('POPULAR');
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
      expect(component.showFilters()).toBeFalse();
      expect(component.tab()).toBe('all');
      expect(component.sort()).toBe('POPULAR');
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

    it('starts from the URL when Back lands on a different home page than memory holds', async () => {
      await leaveAfterScrolling();
      homeUrl = '/?tab=all&q=rock';

      await comeBack({ trigger: 'popstate', extras: {} });

      const posts = expectPosts();
      expect(param(posts, 'q')).toBe('rock');
      posts.flush(page(['z']));
      await settle();
      expect(shownTitles()).toEqual(['Post z']);
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
  });
});
