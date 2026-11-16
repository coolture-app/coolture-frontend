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
import { lucideRefreshCw } from '@ng-icons/lucide';
import { PostFilterParams } from '../../core/models/posts/post-filter-params.model';
import { GeoPoint, NamedPlace } from '../../core/models/common/geo.model';
import { GeocodingService } from '../../core/services/geocoding/geocoding.service';
import { TRICITY } from '../../core/components/map/map-style';
import { PostService } from '../../core/services/post/post.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';
import { PostListStore } from '../../core/services/post-list/post-list.store';
import { HomeTapService } from '../../core/services/home-tap/home-tap.service';
import { Tooltip } from '../../core/directives/tooltip';
import { PostType, PostStatus, PostVisibility, PostsSort } from '../../core/models/common/enums';
import { Map, type MapArea } from '../../core/components/map/map/map';
import { MapFocus } from '../../core/components/map/map-focus';
import { PostMark } from '../../core/models/posts/post-mark.model';
import { backClosable } from '../../core/services/back-closable/back-closable';
import { ToastService } from '../../core/services/toast/toast.service';
import { TranslateService } from '@ngx-translate/core';
import {
  createFiltersForm,
  HomeTab,
  HomeViewMemory,
  NO_FILTERS,
  PlaceFilter,
  RADII_KM,
  START_SORT,
} from './home-view';
import { fromHomeParams, sameHomeParams, toHomeParams } from './home-url';
import { FeedFilters } from './feed-filters/feed-filters';
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
      lucideRefreshCw,
    }),
  ],
  templateUrl: './main-page.html',
  styleUrls: ['./main-page.scss', './main-page-map.scss'],
  host: {
    '(document:click)': 'closeSortMenu($event)',
    '(document:keydown.escape)': 'closePopups()',
    '(window:scroll)': 'onScroll()',
  },
})
export class MainPage implements OnDestroy {
  private postService = inject(PostService);
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
  showSortMenu = signal(false);
  isMapView = signal(false);
  /** The map stays once opened, hidden under Lista, so its style and tiles load once a visit. */
  readonly mapOpened = signal(false);
  /** Back from a post: the map opens where it was left. */
  readonly mapResumes = signal(false);
  /** The post a card's place opened the map on. */
  readonly mapFocusPost = signal<PostMark | null>(null);
  private readonly searchbar = viewChild<ElementRef<HTMLElement>>('searchbar');
  private readonly barHeight = signal(0);
  private readonly phone = signal(false);
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

  /** Wszystkie's orders. Dla Ciebie has no menu: its order is the ranking. */
  sortOptions: { value: PostsSort; labelKey: string }[] = [
    { value: 'UPCOMING', labelKey: 'MAIN_PAGE.sortUpcoming' },
    { value: 'NEAREST', labelKey: 'MAIN_PAGE.sortNearest' },
    { value: 'POPULAR', labelKey: 'MAIN_PAGE.sortPopular' },
    { value: 'RECENT', labelKey: 'MAIN_PAGE.sortRecent' },
  ];

  filtersForm = createFiltersForm();
  /** The user's position, for "Moja lokalizacja" and Najbliższe, once the browser gave it. */
  private nearPosition = signal<GeoPoint | null>(null);
  /**
   * A place that isn't the user's position, for "Wskazane miejsce": searched for, the home, the map's area or a
   * link's point. Its name is empty until a lookup names a point that came without one.
   */
  readonly pickedPlace = signal<NamedPlace | null>(null);
  readonly home = this.authService.home;

  /** The applied search and filters, also what the map shows. Both tabs share them. */
  readonly activeFilters = signal<PostFilterParams>({});
  /** What the applied radius is centred on, for the place pill. */
  readonly activePlace = signal<PlaceFilter>('');
  /** Dla Ciebie is the ranked feed of posts new to the user; Wszystkie is every post, in a chosen order. */
  readonly tab = signal<HomeTab>('forYou');
  /** Wszystkie's order. Kept while on Dla Ciebie, so going back finds it as it was. */
  readonly sort = signal<PostsSort>(START_SORT);
  readonly isFeed = computed(() => this.tab() === 'forYou');
  /** A point the user chose or gave: the radius's centre if one is on, so Najbliższe and the radius agree. */
  private readonly ownPoint = computed<GeoPoint | null>(() => {
    const { latitude, longitude } = this.activeFilters();
    return latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : (this.nearPosition() ?? this.pickedPlace()?.coordinates ?? null);
  });
  /** Where Najbliższe measures from: a point the user chose or gave, else their home. */
  private readonly sortPoint = computed<GeoPoint | null>(
    () => this.ownPoint() ?? this.home()?.coordinates ?? null,
  );
  /** The home's name while Najbliższe measures from it, so the list can say so. */
  readonly nearestFromHome = computed(() =>
    !this.isFeed() && this.sort() === 'NEAREST' && !this.ownPoint()
      ? (this.home()?.name ?? null)
      : null,
  );
  /** How many filters the panel has on, counting a date range as one. Not the search or the place. */
  readonly activeFilterCount = computed(() => {
    const { type, tags, startsFrom, startsTo, visibility, status, includePast } =
      this.activeFilters();
    const on = [type, tags, startsFrom || startsTo, visibility, status, includePast];
    return on.filter((value) => value !== undefined && value !== false).length;
  });
  /** Where suggestions in the place search come from first. */
  readonly searchNear = computed<GeoPoint>(
    () => this.ownPoint() ?? this.home()?.coordinates ?? TRICITY,
  );
  /** A screenful for the first page. After that one is enough, and the posts stay what's on screen. */
  readonly skeletons = computed(() => Array(this.list.items().length > 0 ? 1 : 3));
  readonly pullThreshold = PULL_THRESHOLD;
  readonly nextPageTrigger = computed(() =>
    Math.max(0, this.list.items().length - CARDS_BEFORE_END),
  );

  /** When an empty result could change by looking at past events too. See the contract's table. */
  readonly canOfferPast = computed(() => {
    const { includePast, startsFrom, startsTo } = this.activeFilters();
    const windowApplies = !includePast && !startsFrom && !startsTo;
    return windowApplies && (this.isFeed() || this.sort() !== 'UPCOMING');
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
      const phone = window.matchMedia('(max-width: 639px)');
      const onPhone = () => this.phone.set(phone.matches);
      onPhone();
      phone.addEventListener('change', onPhone);
      const observer = new ResizeObserver(() => this.barHeight.set(bar?.offsetHeight ?? 0));
      if (bar) {
        observer.observe(bar);
      }
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        phone.removeEventListener('change', onPhone);
      });
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
      const nearest = !this.isFeed() && this.sort() === 'NEAREST' ? this.sortPoint() : null;
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
        if (place === 'mine' && !this.nearPosition()) {
          void this.locateForFilter();
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
    this.showSortMenu.set(false);
  }

  togglePlace(): void {
    this.showFilters.set(false);
    this.showPlace.update((v) => !v);
  }

  /** A place from the search, or the home: the radius centres on it, with the radius as it was. */
  pickPlace(place: NamedPlace): void {
    this.pickedPlace.set({ name: place.name, coordinates: place.coordinates });
    this.filtersForm.controls.place.setValue('picked');
  }

  /**
   * The map's "Szukaj w tym obszarze": the circle in its view becomes the picked place, named by a lookup. A view
   * wider than the largest radius gets that radius, and the map zooms in to it.
   */
  searchArea({ centre, radiusKm }: MapArea): void {
    const radius = Math.min(radiusKm, RADII_KM[RADII_KM.length - 1]);
    this.pickedPlace.set({ name: '', coordinates: centre });
    this.filtersForm.patchValue({ place: 'picked', radiusKm: radius }, { emitEvent: false });
    this.applyControls();
    void this.nameThePickedPlace();
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
      this.showSortMenu.set(false);
    }
    this.scrolling.set(true);
    clearTimeout(this.scrollStop);
    this.scrollStop = setTimeout(() => this.scrolling.set(false), SCROLL_STOP_MS);
  }

  toggleFilters(): void {
    this.showPlace.set(false);
    this.showFilters.update((v) => !v);
  }

  /** Filtry's "Wyczyść" leaves the place, which has its own panel. */
  clearFilters(): void {
    const { place, radiusKm } = this.filtersForm.getRawValue();
    this.filtersForm.reset({ ...NO_FILTERS, place, radiusKm }, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.applyControls();
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

  toggleSortMenu(): void {
    this.showSortMenu.update((v) => !v);
  }

  closeSortMenu(event: Event): void {
    if (!(event.target as Element).closest?.('.sort-wrapper')) {
      this.showSortMenu.set(false);
    }
  }

  /** Najbliższe needs a point: the user's position, else their home. With neither, the order stays and a note says why. */
  async setSortBy(sortBy: PostsSort): Promise<void> {
    this.showSortMenu.set(false);
    if (sortBy === 'NEAREST' && !this.ownPoint()) {
      const position = await this.location.request();
      if (position) {
        this.nearPosition.set(position);
      } else if (!this.home()) {
        this.toast.show(this.translate.instant('MAIN_PAGE.nearestNeedsLocation'));
        return;
      }
    }
    this.changeList(() => this.sort.set(sortBy));
  }

  /** Search and filters stay, so the same question gets the other tab's answer. */
  /** On Mapa, the tab already shown goes back to its Lista. */
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

  getSortLabelKey(): string {
    const sort = this.sortOptions.find((o) => o.value === this.sort());
    return sort ? sort.labelKey : 'MAIN_PAGE.sortUpcoming';
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
    this.listOutdated = this.isMapView() && !this.isFeed();
    if (this.listOutdated) {
      return;
    }
    if (this.isMapView()) {
      // A new list under the map opens at its top on Lista.
      this.listScrollY = 0;
    }
    const run = ++this.loadRun;
    if (this.isFeed()) {
      void this.startFeed(run);
    } else {
      const sortBy = this.sort();
      const position = sortBy === 'NEAREST' ? this.sortPoint() : null;
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
    this.pickedPlace.set(point && { name: '', coordinates: point });

    const needsPosition = filters.place === 'mine' || (sort === 'NEAREST' && !point);
    if (needsPosition) {
      const position = await this.location.currentOrAsk(LOCATION_WAIT_MS, LOCATION_ANSWER_MS);
      this.nearPosition.set(position);
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
    if (point) {
      void this.nameThePickedPlace();
    }
  }

  /**
   * A point from the map or a link has no name, so the pill would say only "Wskazane miejsce". The district or city
   * around it names it, if the geocoder answers before the place changes.
   */
  private async nameThePickedPlace(): Promise<void> {
    const place = this.pickedPlace();
    if (!place || place.name) {
      return;
    }
    try {
      const area = await firstValueFrom(this.geocoding.areaAt(place.coordinates));
      if (area && this.pickedPlace() === place) {
        this.pickedPlace.set({ ...place, name: area.name });
      }
    } catch {
      // The pill keeps saying "Wskazane miejsce".
    }
  }

  /** The filters as the form has them, and what their radius is centred on. */
  private applyFilters(): void {
    this.activeFilters.set(this.readFilters());
    this.activePlace.set(
      this.activeFilters().radiusKm ? this.filtersForm.controls.place.value : '',
    );
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
      point: inFilter || nearest ? this.sortPoint() : null,
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
      this.nearPosition.set(position);
      this.applyControls();
    } else {
      this.filtersForm.controls.place.setValue('', { emitEvent: false });
      this.locationFailed.set(true);
    }
  }

  private resetControls(): void {
    this.filtersForm.reset(NO_FILTERS, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
    this.pickedPlace.set(null);
  }

  /** The radius filter's centre, if it's on. */
  private filterCentre(): GeoPoint | null {
    const place = this.filtersForm.controls.place.value;
    if (place === 'picked') {
      return this.pickedPlace()?.coordinates ?? null;
    }
    return place === 'mine' ? this.nearPosition() : null;
  }

  private readFilters(): PostFilterParams {
    const search = this.searchControl.value.trim();
    const { type, tags, startsFrom, startsTo, visibility, status, includePast, radiusKm } =
      this.filtersForm.getRawValue();
    const position = this.filterCentre();
    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    return {
      ...(search && { q: search }),
      ...(type && { type: type as PostType }),
      ...(tagList.length > 0 && { tags: tagList }),
      ...(startsFrom && { startsFrom: new Date(startsFrom).toISOString() }),
      ...(startsTo && { startsTo: new Date(startsTo).toISOString() }),
      ...(visibility && { visibility: visibility as PostVisibility }),
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
      nearPosition: this.nearPosition(),
      pickedPlace: this.pickedPlace(),
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
    this.nearPosition.set(view.nearPosition);
    this.pickedPlace.set(view.pickedPlace);
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
