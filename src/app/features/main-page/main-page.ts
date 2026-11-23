import {
  afterNextRender,
  Component,
  computed,
  linkedSignal,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  Injector,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationStart, Params, Router } from '@angular/router';
import { debounceTime, filter, firstValueFrom, merge } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroAdjustmentsHorizontal,
  heroMagnifyingGlass,
  heroXMark,
  heroChevronDown,
  heroMapPin,
} from '@ng-icons/heroicons/outline';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PostComponent } from '../../core/components/post-component/post-component';
import { Btn } from '../../core/components/btn/btn';
import { PostSkeleton } from '../../core/components/post-skeleton/post-skeleton';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { PULL_THRESHOLD, PullToRefresh } from '../../core/directives/pull-to-refresh';
import { lucideRadio, lucideRefreshCw } from '@ng-icons/lucide';
import { PostFilterParams } from '../../core/models/posts/post-filter-params.model';
import { NamedPlace } from '../../core/models/common/geo.model';
import { GeocodingService } from '../../core/services/geocoding/geocoding.service';
import { PostService } from '../../core/services/post/post.service';
import { KindsService } from '../../core/services/interests/kinds.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';
import { PostListStore } from '../../core/services/post-list/post-list.store';
import { HomeTapService } from '../../core/services/home-tap/home-tap.service';
import { Tooltip } from '../../core/directives/tooltip';
import { PostStatus, PostsSort } from '../../core/models/common/enums';
import { Map, type MapArea } from '../../core/components/map/map/map';
import { MapFocus } from '../../core/components/map/map-focus';
import { PostMark } from '../../core/models/posts/post-mark.model';
import { backClosable } from '../../core/services/back-closable/back-closable';
import { ToastService } from '../../core/services/toast/toast.service';
import { mediaQuery, WIDE_FROM_PX } from '../../core/services/media-query/media-query';
import { TranslateService } from '@ngx-translate/core';
import {
  createFiltersForm,
  HomeTab,
  HomeViewMemory,
  NO_FILTERS,
  PlaceFilter,
  RADII_KM,
  START_SORT,
  dayWindow,
} from './home-view';
import { fromHomeParams, sameHomeParams, toHomeParams } from './home-url';
import { FeedFilters } from './feed-filters/feed-filters';
import { HomePlace } from './home-place';
import { PlacePanel } from './place-panel/place-panel';
import { ViewSwitch } from './view-switch/view-switch';

const LOCATION_WAIT_MS = 1500;
/** How long the first page waits for an answer to the browser's location prompt. */
const LOCATION_ANSWER_MS = 8000;
/** Near the top the bar stays, so it never hides with nothing under it. */
const BAR_ALWAYS_SHOWN_PX = 120;
/**
 * How long after the last scroll event the bar turns solid again. A mouse wheel sends separate
 * ticks with gaps of a few hundred ms, which shouldn't count as stopping.
 */
const SCROLL_STOP_MS = 1000;
/**
 * How many cards before the end the next page is requested. Counted in cards, not pixels, so it means
 * the same on any screen, and it's under the page size of 20, so a new page can't ask for the next one
 * by itself. A page took about 1.1 s locally, and a fast flick covers about 6000 px a second.
 */
const CARDS_BEFORE_END = 15;
/** How many of the feed's first posts the map lights up as top picks on Dla Ciebie. */
const MAP_PICKS = 30;
/** Wszystkie's orders. Dla Ciebie has no menu: its order is the ranking. */
const SORT_OPTIONS: { value: PostsSort; labelKey: string }[] = [
  { value: 'UPCOMING', labelKey: 'MAIN_PAGE.sortUpcoming' },
  { value: 'NEAREST', labelKey: 'MAIN_PAGE.sortNearest' },
  { value: 'POPULAR', labelKey: 'MAIN_PAGE.sortPopular' },
  { value: 'RECENT', labelKey: 'MAIN_PAGE.sortRecent' },
];

@Component({
  selector: 'app-main-page',
  imports: [
    TranslatePipe,
    NgIcon,
    PostComponent,
    ReactiveFormsModule,
    Btn,
    Map,
    FeedFilters,
    PlacePanel,
    ViewSwitch,
    InfiniteScroll,
    PullToRefresh,
    PostSkeleton,
    Tooltip,
  ],
  viewProviders: [
    provideIcons({
      heroAdjustmentsHorizontal,
      heroMagnifyingGlass,
      heroXMark,
      heroChevronDown,
      heroMapPin,
      lucideRadio,
      lucideRefreshCw,
    }),
  ],
  templateUrl: './main-page.html',
  styleUrls: ['./main-page.scss', './main-page-toolbar.scss', './main-page-map.scss'],
  host: {
    '(document:keydown.escape)': 'closePopups()',
    '(window:scroll)': 'onScroll()',
  },
})
export class MainPage implements OnDestroy {
  private postService = inject(PostService);
  /** Created with the page, so its catalogue is loaded by the time Filtry opens. */
  private kinds = inject(KindsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private location = inject(LocationService);
  private scroller = inject(ViewportScroller);
  private memory = inject(HomeViewMemory);
  private homeTap = inject(HomeTapService);
  private injector = inject(Injector);
  private toast = inject(ToastService);
  private geocoding = inject(GeocodingService);
  private translate = inject(TranslateService);
  private mapFocus = inject(MapFocus);
  /** A place tapped on a card here opens the map in a history entry of its own, so Back returns to the card. */
  private mapOverlay = backClosable('mapFocus', () => this.toggleMapView(false));
  authService = inject(AuthService);
  list = inject(PostListStore);

  searchControl = new FormControl('', { nonNullable: true });

  showFilters = signal(false);
  showPlace = signal(false);
  isMapView = signal(false);
  /** The map stays once opened, hidden under Lista, so its style and tiles load once a visit. */
  readonly mapOpened = signal(false);
  /** Back from a post: the map opens where it was left. */
  readonly mapResumes = signal(false);
  /** The post a card's place opened the map on. */
  readonly mapFocusPost = signal<PostMark | null>(null);
  private readonly searchbar = viewChild<ElementRef<HTMLElement>>('searchbar');
  private readonly barHeight = signal(0);
  private readonly phone = mediaQuery(`(max-width: ${WIDE_FROM_PX - 1}px)`);
  /** On a phone's Mapa the bar floats over the map's top, so the map keeps its own buttons and middle below it. */
  readonly mapTopInset = computed(() => (this.isMapView() && this.phone() ? this.barHeight() : 0));
  locationFailed = signal(false);
  locating = signal(false);
  /** While the page moves the bar is see-through, and it turns solid once scrolling stops. */
  scrolling = signal(false);
  /** Phones only, in the styles: the bar slides away while scrolling down, back on scrolling up. */
  barHidden = signal(false);
  private lastScrollY = 0;
  /** Where the list was scrolled to when the map replaced it, to land there again on the way back. */
  private listScrollY = 0;
  private scrollStop: ReturnType<typeof setTimeout> | undefined;

  filtersForm = createFiltersForm();
  readonly home = this.authService.home;

  /** The applied search and filters, also what the map shows. Both tabs share them. */
  readonly activeFilters = signal<PostFilterParams>({});
  readonly place = new HomePlace(
    this.home,
    computed(() => {
      const { latitude, longitude } = this.activeFilters();
      return latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;
    }),
    (point) => this.geocoding.areaAt(point),
  );
  /** What the applied radius is centred on, or Online, for the place pill. */
  readonly activePlace = signal<PlaceFilter>('');
  /** Online posts have no place, so there's nothing to measure from or show on a map. */
  readonly isOnline = computed(() => this.activePlace() === 'online');
  /** The picked place up to its first comma, "Śródmieście" of "Śródmieście, Gdynia", so the pill fits a phone. */
  readonly pickedShortName = computed(() => this.place.picked()?.name.split(',')[0].trim() ?? '');
  readonly sortOptions = computed(() =>
    this.isOnline() ? SORT_OPTIONS.filter((option) => option.value !== 'NEAREST') : SORT_OPTIONS,
  );
  /** Dla Ciebie is the ranked feed of posts new to the user; Wszystkie is every post, in a chosen order. */
  readonly tab = signal<HomeTab>('forYou');
  /** Wszystkie's order. Kept while on Dla Ciebie, so going back finds it as it was. */
  readonly sort = signal<PostsSort>(START_SORT);
  readonly isFeed = computed(() => this.tab() === 'forYou');
  /** The home's name while Najbliższe measures from it, so the list can say so. */
  readonly nearestFromHome = computed(() =>
    !this.isFeed() && this.sort() === 'NEAREST' && !this.place.own()
      ? (this.home()?.name ?? null)
      : null,
  );
  /**
   * How many filters the panel has on, counting a date range and the chosen kinds as one each, and Wszystkie's order
   * when it isn't the first. Not the search or the place, Online included.
   */
  readonly activeFilterCount = computed(() => {
    const { kinds, kids, from, to, followed, status, includePast } = this.activeFilters();
    const resorted = !this.isFeed() && this.sort() !== START_SORT;
    const on = [kinds, kids, from || to, followed, status, includePast, resorted || undefined];
    return on.filter((value) => value !== undefined && value !== false).length;
  });
  /** A screenful for the first page. After that one is enough, and the posts stay what's on screen. */
  readonly skeletons = computed(() => Array(this.list.items().length > 0 ? 1 : 3));
  readonly pullThreshold = PULL_THRESHOLD;
  readonly nextPageTrigger = computed(() =>
    Math.max(0, this.list.items().length - CARDS_BEFORE_END),
  );

  /** When an empty result could change by looking at past events too. See the contract's table. */
  readonly canOfferPast = computed(() => {
    const { includePast, from, to } = this.activeFilters();
    return !includePast && !from && !to;
  });
  /** Dla Ciebie hides what the user saw or saved, so a search there points to Wszystkie too. */
  readonly canOfferAll = computed(() => this.isFeed() && !!this.activeFilters().q);
  /** The next radius chip, offered when nothing is inside the current one. */
  readonly widerRadius = computed(() => {
    const radius = this.activeFilters().radiusKm;
    return radius === undefined ? null : (RADII_KM.find((km) => km > radius) ?? null);
  });

  /**
   * Dla Ciebie's first posts, which the map lights up. Null on Wszystkie, where no pin stands out. While a new list's
   * first page loads, the last picks stay, so the stars don't blink off and on.
   */
  readonly mapPicks = linkedSignal<
    { feed: boolean; ids: string[]; waiting: boolean },
    ReadonlySet<string> | null
  >({
    source: () => ({
      feed: this.isFeed(),
      ids:
        this.list.query()?.kind === 'feed'
          ? this.list
              .items()
              .slice(0, MAP_PICKS)
              .map((post) => post.id)
          : [],
      waiting: this.list.loading() && this.list.items().length === 0,
    }),
    computation: ({ feed, ids, waiting }, previous) =>
      !feed ? null : waiting && previous?.value ? previous.value : new Set(ids),
  });

  /** False until the first render in the browser, so a prerendered page never holds a response. */
  private ready = signal(false);
  private loadRun = 0;
  private listOutdated = false;

  constructor() {
    const restored = this.restoreView();
    if (!restored) {
      // Read now, not with the rest of the URL, so a reload on Mapa never starts Lista first.
      this.isMapView.set(fromHomeParams(this.route.snapshot.queryParams).map);
    }
    this.postService.clearActivePost();
    this.mapOpened.set(this.isMapView());
    this.mapResumes.set(restored && this.isMapView());
    const focus = this.mapFocus.take();
    if (focus) {
      this.openOnMap(focus, false);
    }
    effect(() => {
      if (this.mapFocus.requested()) {
        untracked(() => this.openOnMap(this.mapFocus.take()!, true));
      }
    });

    afterNextRender(() => {
      const bar = this.searchbar()?.nativeElement;
      const observer = new ResizeObserver(() => this.barHeight.set(bar?.offsetHeight ?? 0));
      if (bar) {
        observer.observe(bar);
      }
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // The page is prerendered with no query, so the URL applies only after hydration matched it.
    afterNextRender(() => {
      if (restored) {
        this.ready.set(true);
      } else {
        void this.openFromUrl().then(() => this.ready.set(true));
      }
    });

    // Cards measure distances from the point the list was filtered or sorted by, so they agree with
    // it: the radius's centre, or Najbliższe's position. See LocationService.
    effect(() => {
      const { latitude, longitude, radiusKm } = this.activeFilters();
      const nearest = !this.isFeed() && this.sort() === 'NEAREST' ? this.place.sortPoint() : null;
      const centre = radiusKm && latitude !== undefined && longitude !== undefined;
      this.location.measureFrom(centre ? { latitude, longitude } : nearest);
    });

    // First open, and again if the store was cleared because the user changed.
    effect(() => {
      if (this.ready() && this.list.query() === null) {
        untracked(() => this.load());
      }
    });

    this.homeTap.freshFeed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.startFresh());

    this.filtersForm.controls.place.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((place) => {
        this.locationFailed.set(false);
        if (place === 'mine' && !this.place.position()) {
          void this.locateForFilter();
        } else if (place === 'online') {
          this.showOnline();
        } else if (place === '') {
          // Else Najbliższe would go on measuring from a place the pill no longer shows.
          this.place.picked.set(null);
        }
      });

    merge(this.searchControl.valueChanges, this.filtersForm.valueChanges)
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyControls());

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.saveView());
  }

  ngOnDestroy(): void {
    clearTimeout(this.scrollStop);
    this.location.measureFrom(null);
  }

  applyControls(): void {
    this.changeList(() => this.applyFilters());
  }

  closePopups(): void {
    this.showFilters.set(false);
    this.showPlace.set(false);
  }

  togglePlace(): void {
    this.showFilters.set(false);
    this.showPlace.update((v) => !v);
  }

  /** A place from the search, or the home: the radius centres on it, with the radius as it was. */
  pickPlace(place: NamedPlace): void {
    this.place.pick(place);
    this.filtersForm.controls.place.setValue('picked');
  }

  /**
   * The map's "Szukaj w tym obszarze": the circle in its view becomes the picked place, named by a lookup. A view
   * wider than the largest radius gets that radius, and the map zooms in to it.
   */
  searchArea({ centre, radiusKm }: MapArea): void {
    const radius = Math.min(radiusKm, RADII_KM[RADII_KM.length - 1]);
    this.place.pickPoint(centre);
    this.filtersForm.patchValue({ place: 'picked', radiusKm: radius }, { emitEvent: false });
    this.applyControls();
  }

  clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.applyControls();
  }

  onScroll(): void {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;
    if (y < BAR_ALWAYS_SHOWN_PX || delta < 0 || this.showFilters() || this.showPlace()) {
      this.barHidden.set(false);
    } else if (delta > 0) {
      this.barHidden.set(true);
    }
    this.scrolling.set(true);
    clearTimeout(this.scrollStop);
    this.scrollStop = setTimeout(() => this.scrolling.set(false), SCROLL_STOP_MS);
  }

  toggleFilters(): void {
    this.showPlace.set(false);
    this.showFilters.update((v) => !v);
  }

  /** Filtry's "Wyczyść" leaves the place, which has its own panel. Wszystkie's order is in Filtry, so it goes too. */
  clearFilters(): void {
    const { place, radiusKm } = this.filtersForm.getRawValue();
    this.filtersForm.reset({ ...NO_FILTERS, place, radiusKm }, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.changeList(() => {
      if (!this.isFeed()) {
        this.sort.set(START_SORT);
      }
      this.applyFilters();
    });
  }

  /** The empty state's shortcut. The panel opens, so that the user can see and undo what's now on. */
  searchPastToo(): void {
    this.showFilters.set(true);
    this.filtersForm.controls.includePast.setValue(true, { emitEvent: false });
    this.applyControls();
  }

  removeChild(idToRemove: string): void {
    this.list.removeItem(idToRemove);
  }

  /** A new session that keeps the cards in view until its first page arrives, and keeps them if it fails. */
  async renewList(): Promise<void> {
    if (!(await this.list.renew())) {
      this.toast.show(this.translate.instant('MAIN_PAGE.refreshFailed'));
    }
  }

  /** Najbliższe needs a point: the user's position, else their home. With neither, the order stays and a note says why. */
  async setSortBy(sortBy: PostsSort): Promise<void> {
    if (sortBy === 'NEAREST' && !this.place.own()) {
      const position = await this.location.request();
      if (position) {
        this.place.position.set(position);
      } else if (!this.home()) {
        this.toast.show(this.translate.instant('MAIN_PAGE.nearestNeedsLocation'));
        return;
      }
    }
    this.changeList(() => this.sort.set(sortBy));
  }

  /**
   * Search and filters stay, so the same question gets the other tab's answer. On Mapa, the tab already shown goes
   * back to its Lista.
   */
  setTab(tab: HomeTab): void {
    if (tab === this.tab() && this.isMapView()) {
      this.toggleMapView(false);
      return;
    }
    this.changeList(() => this.tab.set(tab));
  }

  /** The empty list's shortcut: the next radius chip. The panel shows the new value. */
  widenRadius(): void {
    const radius = this.widerRadius();
    if (radius !== null) {
      this.filtersForm.controls.radiusKm.setValue(radius, { emitEvent: false });
      this.applyControls();
    }
  }

  toggleMapView(isToggled: boolean): void {
    if (isToggled === this.isMapView()) {
      return;
    }
    if (!isToggled && this.mapOverlay.isOpen()) {
      // Back to the card the map was opened from, through its history entry.
      this.mapOverlay.close();
      return;
    }
    if (isToggled) {
      this.listScrollY = this.scroller.getScrollPosition()[1];
      this.mapOpened.set(true);
    }
    this.isMapView.set(isToggled);
    this.showInUrl();
    if (isToggled) {
      return;
    }
    if (this.listOutdated || this.list.query() === null) {
      this.load();
    } else {
      // The same list renders again from the store, so the same card is at the same place.
      const y = this.listScrollY;
      afterNextRender(() => this.scroller.scrollToPosition([0, y]), { injector: this.injector });
    }
  }

  /** Home tapped at the top: the default feed again, as a new session with a new first page. */
  startFresh(): void {
    this.resetControls();
    this.tab.set('forYou');
    this.sort.set(START_SORT);
    this.applyFilters();
    this.isMapView.set(false);
    this.showInUrl();
    this.load();
  }

  /** At once rather than after the form's debounce, as the map goes and Najbliższe falls back to the first order. */
  private showOnline(): void {
    this.changeList(() => {
      if (this.sort() === 'NEAREST') {
        this.sort.set(START_SORT);
      }
      this.applyFilters();
    });
    this.toggleMapView(false);
  }

  /** Applies a change, and starts a new list only if it changes which list should be showing. */
  private changeList(change: () => void): void {
    const listKey = () =>
      JSON.stringify([this.tab(), this.isFeed() ? null : this.sort(), this.activeFilters()]);
    const before = listKey();
    change();
    if (listKey() !== before) {
      // A different list starts at its beginning, not where the last one was scrolled to.
      this.scroller.scrollToPosition([0, 0]);
      this.showInUrl();
      this.load();
    }
  }

  /** The map on a post: from its card on this page, in a history entry of its own; from another page, as it opens. */
  private openOnMap(post: PostMark, fromThisPage: boolean): void {
    this.mapFocusPost.set(post);
    if (this.isMapView()) {
      return;
    }
    if (fromThisPage) {
      this.listScrollY = this.scroller.getScrollPosition()[1];
      // Its entry says Mapa, so a reload there stays on the map, and Back returns to Lista's entry.
      const queryParams = { ...this.urlParams(), view: 'map' };
      this.mapOverlay.opened({
        pageStaysLive: true,
        url: this.router.serializeUrl(
          this.router.createUrlTree([], { relativeTo: this.route, queryParams }),
        ),
      });
    }
    this.mapOpened.set(true);
    this.isMapView.set(true);
  }

  /** Under the map, Wszystkie waits for Lista. Dla Ciebie loads, as its first posts are the map's top picks. */
  private load(): void {
    // Counted before the early return, so a Dla Ciebie start still waiting for a position is dropped.
    const run = ++this.loadRun;
    this.listOutdated = this.isMapView() && !this.isFeed();
    if (this.listOutdated) {
      return;
    }
    if (this.isMapView()) {
      // A new list under the map opens at its top on Lista.
      this.listScrollY = 0;
    }
    if (this.isFeed()) {
      void this.startFeed(run);
    } else {
      const sortBy = this.sort();
      const position = sortBy === 'NEAREST' ? this.place.sortPoint() : null;
      this.list.start({
        kind: 'posts',
        filters: { ...this.activeFilters(), ...position, sortBy },
      });
    }
  }

  /**
   * Uses the position when it's allowed and arrives quickly. On the first open, if the browser hasn't
   * decided yet, it asks, and the first page waits a little for the answer.
   */
  private async startFeed(run: number): Promise<void> {
    const location = await this.location.currentOrAsk(LOCATION_WAIT_MS, LOCATION_ANSWER_MS);
    if (run === this.loadRun) {
      this.list.start({
        kind: 'feed',
        ...(location && { location }),
        filters: this.activeFilters(),
      });
    }
  }

  /**
   * Puts the page in the state its URL describes. A radius or Najbliższe with no point in the link
   * needs the reader's position, and without it they fall back as they do when picked by hand.
   */
  private async openFromUrl(): Promise<void> {
    // After this render's own check has finished, which the form's values would otherwise change under.
    await Promise.resolve();
    const { search, filters, tab, sort, point } = fromHomeParams(this.route.snapshot.queryParams);
    this.searchControl.setValue(search, { emitEvent: false });
    this.filtersForm.setValue(filters, { emitEvent: false });
    this.tab.set(tab);
    this.sort.set(sort);
    this.place.pickPoint(point);

    // On a reload /auth/me may not have answered yet, and the filter means nothing for a guest.
    if (filters.followed && !(await this.signedIn())) {
      this.filtersForm.controls.followed.setValue(false, { emitEvent: false });
    }

    const needsPosition = filters.place === 'mine' || (sort === 'NEAREST' && !point);
    if (needsPosition) {
      const position = await this.location.currentOrAsk(LOCATION_WAIT_MS, LOCATION_ANSWER_MS);
      this.place.position.set(position);
      if (!position && filters.place === 'mine') {
        this.filtersForm.controls.place.setValue('', { emitEvent: false });
        this.locationFailed.set(true);
      }
      if (!position && sort === 'NEAREST' && !this.home()) {
        this.sort.set(START_SORT);
        this.toast.show(this.translate.instant('MAIN_PAGE.nearestNeedsLocation'));
      }
    }
    this.applyFilters();
    this.showInUrl();
  }

  private async signedIn(): Promise<boolean> {
    return this.authService.isAuthenticated() || firstValueFrom(this.authService.checkSession());
  }

  /** The filters as the form has them, and what their radius is centred on. */
  private applyFilters(): void {
    const filters = this.readFilters();
    const place = this.filtersForm.controls.place.value;
    this.activeFilters.set(filters);
    this.activePlace.set(filters.radiusKm || place === 'online' ? place : '');
  }

  /** The current state as the URL's query string. */
  private urlParams(): Params {
    const { latitude, longitude } = this.activeFilters();
    const nearest = !this.isFeed() && this.sort() === 'NEAREST';
    const inFilter = latitude !== undefined && longitude !== undefined;
    return toHomeParams({
      search: this.searchControl.value,
      filters: this.filtersForm.getRawValue(),
      tab: this.tab(),
      sort: this.sort(),
      point: inFilter || nearest ? this.place.sortPoint() : null,
      map: this.isMapView(),
    });
  }

  /** Replaces the URL, so Back still leaves the home page rather than undoing each filter. */
  private showInUrl(): void {
    const queryParams = this.urlParams();
    const current = this.router.parseUrl(this.router.url).queryParams;
    if (!sameHomeParams(queryParams, current)) {
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    }
  }

  /** "Moja lokalizacja" needs the position first. Without it, the filter goes back to "Wszędzie". */
  private async locateForFilter(): Promise<void> {
    this.locating.set(true);
    const position = await this.location.request();
    this.locating.set(false);
    if (position) {
      this.place.position.set(position);
      this.applyControls();
    } else {
      this.filtersForm.controls.place.setValue('', { emitEvent: false });
      this.locationFailed.set(true);
    }
  }

  private resetControls(): void {
    this.filtersForm.reset(NO_FILTERS, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.place.picked.set(null);
  }

  private readFilters(): PostFilterParams {
    const search = this.searchControl.value.trim();
    const { kinds, kids, fromDay, toDay, followed, status, includePast, place, radiusKm } =
      this.filtersForm.getRawValue();
    const position = this.place.centre(place);

    return {
      ...(search && { q: search }),
      ...(kinds.length && { kinds }),
      ...(kids && { kids }),
      ...(place === 'online' && { type: 'ONLINE' as const }),
      ...dayWindow(fromDay, toDay),
      ...(followed && this.authService.isAuthenticated() && { followed }),
      ...(status && { status: status as PostStatus }),
      ...(includePast && { includePast }),
      ...(position && { ...position, radiusKm }),
    };
  }

  private saveView(): void {
    this.memory.save({
      search: this.searchControl.value,
      filters: this.filtersForm.getRawValue(),
      tab: this.tab(),
      sort: this.sort(),
      isMapView: this.isMapView(),
      listScrollY: this.listScrollY,
      nearPosition: this.place.position(),
      pickedPlace: this.place.picked(),
      url: this.urlParams(),
    });
  }

  /**
   * On Back or Forward, puts the page back as it was left, from memory and with no request, so the
   * router's scroll restoration lands on the same card. Otherwise a new list will start, from the URL.
   * Memory holds the last home page left, which may not be the entry Back landed on, so the URL decides.
   */
  private restoreView(): boolean {
    const comingBack = this.router.currentNavigation()?.trigger === 'popstate';
    const view = comingBack ? this.memory.restore() : null;
    if (!view || !sameHomeParams(view.url, this.route.snapshot.queryParams)) {
      this.list.clear();
      return false;
    }

    this.searchControl.setValue(view.search, { emitEvent: false });
    this.filtersForm.setValue(view.filters, { emitEvent: false });
    this.tab.set(view.tab);
    this.sort.set(view.sort);
    this.place.position.set(view.nearPosition);
    this.place.picked.set(view.pickedPlace);
    this.isMapView.set(view.isMapView);
    this.listScrollY = view.listScrollY;
    this.applyFilters();

    const post = this.postService.activePost();
    if (post) {
      this.list.updateItem(post);
    }
    return true;
  }
}
