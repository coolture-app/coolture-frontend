import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { debounceTime, filter, merge } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroAdjustmentsHorizontal,
  heroMagnifyingGlass,
  heroXMark,
  heroChevronDown,
} from '@ng-icons/heroicons/outline';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PostComponent } from '../../core/components/post-component/post-component';
import { Btn } from '../../core/components/btn/btn';
import { PostSkeleton } from '../../core/components/post-skeleton/post-skeleton';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { PostFilterParams } from '../../core/models/posts/post-filter-params.model';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostService } from '../../core/services/post/post.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';
import { PostListStore } from '../../core/services/post-list/post-list.store';
import { HomeTapService } from '../../core/services/home-tap/home-tap.service';
import { Tooltip } from '../../core/directives/tooltip';
import {
  PostType,
  PostStatus,
  PostVisibility,
  PostSortBy,
  PostsSort,
} from '../../core/models/common/enums';
import { Map } from '../../core/components/map/map/map';
import { createFiltersForm, HomeViewMemory, NO_FILTERS } from './home-view';
import { FeedFilters } from './feed-filters/feed-filters';

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
    InfiniteScroll,
    PostSkeleton,
    Tooltip,
  ],
  viewProviders: [
    provideIcons({
      heroAdjustmentsHorizontal,
      heroMagnifyingGlass,
      heroXMark,
      heroChevronDown,
    }),
  ],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
  host: {
    '(document:click)': 'closeSortMenu($event)',
    '(document:keydown.escape)': 'closePopups()',
    '(window:scroll)': 'onScroll()',
  },
})
export class MainPage implements OnDestroy {
  private postService = inject(PostService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private location = inject(LocationService);
  private scroller = inject(ViewportScroller);
  private memory = inject(HomeViewMemory);
  private homeTap = inject(HomeTapService);
  private injector = inject(Injector);
  authService = inject(AuthService);
  list = inject(PostListStore);

  searchControl = new FormControl('', { nonNullable: true });

  showFilters = signal(false);
  showSortMenu = signal(false);
  isMapView = signal(false);
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

  sortOptions: { value: PostSortBy; labelKey: string }[] = [
    { value: 'RECOMMENDED', labelKey: 'MAIN_PAGE.sortRecommended' },
    { value: 'RECENT', labelKey: 'MAIN_PAGE.sortRecent' },
    { value: 'POPULAR', labelKey: 'MAIN_PAGE.sortPopular' },
    { value: 'UPCOMING', labelKey: 'MAIN_PAGE.sortUpcoming' },
  ];

  filtersForm = createFiltersForm();
  /** The position "Moja lokalizacja" filters by, once the browser gave it. Never stored. */
  private nearPosition = signal<GeoPoint | null>(null);

  /** The applied search and filters, also what the map shows. */
  readonly activeFilters = signal<PostFilterParams>({});
  /** A sort the user chose. Without one, the list follows the search and filters. */
  private pickedSort = signal<PostsSort | null>(null);

  readonly currentSortBy = computed<PostSortBy>(() => {
    const noCriteria = Object.keys(this.activeFilters()).length === 0;
    return this.pickedSort() ?? (noCriteria ? 'RECOMMENDED' : 'RECENT');
  });
  readonly isFeed = computed(() => this.currentSortBy() === 'RECOMMENDED');
  /** How many filters the panel has on, counting a date range and a place as one each. Not the search. */
  readonly activeFilterCount = computed(() => {
    const { type, tags, startsFrom, startsTo, visibility, status, includePast, latitude } =
      this.activeFilters();
    const on = [type, tags, startsFrom || startsTo, visibility, status, includePast, latitude];
    return on.filter((value) => value !== undefined && value !== false).length;
  });
  /** A screenful for the first page. After that one is enough, and the posts stay what's on screen. */
  readonly skeletons = computed(() => Array(this.list.items().length > 0 ? 1 : 3));
  readonly nextPageTrigger = computed(() =>
    Math.max(0, this.list.items().length - CARDS_BEFORE_END),
  );

  /** When an empty result could change by looking at past events too. See the contract's table. */
  readonly canOfferPast = computed(() => {
    const { includePast, startsFrom, startsTo } = this.activeFilters();
    const windowApplies = !includePast && !startsFrom && !startsTo;
    return !this.isFeed() && windowApplies && this.currentSortBy() !== 'UPCOMING';
  });

  /** False until the first render in the browser, so a prerendered page never holds a response. */
  private ready = signal(false);
  private loadRun = 0;
  private listOutdated = false;

  constructor() {
    this.restoreView();
    this.postService.clearActivePost();

    afterNextRender(() => this.ready.set(true));

    // First open, and again if the store was cleared because the user changed.
    effect(() => {
      if (this.ready() && this.list.query() === null) {
        untracked(() => this.load());
      }
    });

    this.homeTap.freshFeed
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.startFresh());

    this.filtersForm.controls.near.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((near) => {
        this.locationFailed.set(false);
        if (near && !this.nearPosition()) {
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
  }

  applyControls(): void {
    this.changeList(() => this.activeFilters.set(this.readFilters()));
  }

  closePopups(): void {
    this.showFilters.set(false);
    this.showSortMenu.set(false);
  }

  clearSearch(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.applyControls();
  }

  onScroll(): void {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;
    if (y < BAR_ALWAYS_SHOWN_PX || delta < 0 || this.showFilters()) {
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
    this.showFilters.update((v) => !v);
  }

  clearFilters(): void {
    this.resetControls();
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

  toggleSortMenu(): void {
    this.showSortMenu.update((v) => !v);
  }

  closeSortMenu(event: Event): void {
    if (!(event.target as Element).closest?.('.sort-wrapper')) {
      this.showSortMenu.set(false);
    }
  }

  setSortBy(sortBy: PostSortBy): void {
    this.showSortMenu.set(false);
    this.changeList(() => {
      if (sortBy === 'RECOMMENDED') {
        this.resetControls();
      }
      this.pickedSort.set(sortBy === 'RECOMMENDED' ? null : sortBy);
      this.activeFilters.set(this.readFilters());
    });
  }

  getSortLabelKey(): string {
    const sort = this.sortOptions.find((o) => o.value === this.currentSortBy());
    return sort ? sort.labelKey : 'MAIN_PAGE.sortRecent';
  }

  toggleMapView(isToggled: boolean): void {
    if (isToggled === this.isMapView()) {
      return;
    }
    if (isToggled) {
      this.listScrollY = this.scroller.getScrollPosition()[1];
    }
    this.isMapView.set(isToggled);
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
    this.pickedSort.set(null);
    this.activeFilters.set(this.readFilters());
    this.isMapView.set(false);
    this.load();
  }

  /** Applies a change, and starts a new list only if it changes which list should be showing. */
  private changeList(change: () => void): void {
    const listKey = () => JSON.stringify([this.currentSortBy(), this.activeFilters()]);
    const before = listKey();
    change();
    if (listKey() !== before) {
      // A different list starts at its beginning, not where the last one was scrolled to.
      this.scroller.scrollToPosition([0, 0]);
      this.load();
    }
  }

  private load(): void {
    this.listOutdated = this.isMapView();
    if (this.isMapView()) {
      return;
    }
    const run = ++this.loadRun;
    if (this.isFeed()) {
      void this.startFeed(run);
    } else {
      this.list.start({
        kind: 'posts',
        filters: { ...this.activeFilters(), sortBy: this.currentSortBy() as PostsSort },
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
      this.list.start({ kind: 'feed', ...(location && { location }) });
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
      this.filtersForm.controls.near.setValue(false, { emitEvent: false });
      this.locationFailed.set(true);
    }
  }

  private resetControls(): void {
    this.filtersForm.reset(NO_FILTERS, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
  }

  private readFilters(): PostFilterParams {
    const search = this.searchControl.value.trim();
    const { type, tags, startsFrom, startsTo, visibility, status, includePast, near, radiusKm } =
      this.filtersForm.getRawValue();
    const position = near ? this.nearPosition() : null;
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
      pickedSort: this.pickedSort(),
      isMapView: this.isMapView(),
      listScrollY: this.listScrollY,
      nearPosition: this.nearPosition(),
    });
  }

  /**
   * On Back or Forward, puts the page back as it was left, from memory and with no request, so the
   * router's scroll restoration lands on the same card. Otherwise a new list will start.
   */
  private restoreView(): void {
    const comingBack = this.router.currentNavigation()?.trigger === 'popstate';
    const view = comingBack ? this.memory.restore() : null;
    if (!view) {
      this.list.clear();
      return;
    }

    this.searchControl.setValue(view.search, { emitEvent: false });
    this.filtersForm.setValue(view.filters, { emitEvent: false });
    this.pickedSort.set(view.pickedSort);
    this.nearPosition.set(view.nearPosition);
    this.isMapView.set(view.isMapView);
    this.listScrollY = view.listScrollY;
    this.activeFilters.set(this.readFilters());

    const post = this.postService.activePost();
    if (post) {
      this.list.updateItem(post);
    }
  }
}
