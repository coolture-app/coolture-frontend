import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { FormControl, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { debounceTime, filter, merge } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroMagnifyingGlass,
  heroMapPin,
  heroPlus,
  heroFunnel,
  heroXMark,
  heroChevronDown,
} from '@ng-icons/heroicons/outline';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PostComponent } from '../../core/components/post-component/post-component';
import { Btn } from '../../core/components/btn/btn';
import { InfiniteScroll } from '../../core/directives/infinite-scroll';
import { PostFilterParams } from '../../core/models/posts/post-filter-params.model';
import { PostService } from '../../core/services/post/post.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { LocationService } from '../../core/services/location/location.service';
import { PostListStore, PostListView } from '../../core/services/post-list/post-list.store';
import {
  PostType,
  PostStatus,
  PostVisibility,
  PostSortBy,
  PostsSort,
} from '../../core/models/common/enums';
import { Switch } from '../../core/components/switch/switch/switch';
import { Map } from '../../core/components/map/map/map';

/** Navigation state that asks the home page to put the list back, as the browser's Back button does. */
export const RESTORE_LIST_STATE = { restoreList: true };

const LOCATION_WAIT_MS = 1500;
const NO_FILTERS = {
  type: '',
  tags: '',
  startsFrom: '',
  startsTo: '',
  visibility: '',
  status: '',
  includePast: false,
};
type FilterValues = typeof NO_FILTERS;

@Component({
  selector: 'app-main-page',
  imports: [
    TranslatePipe,
    NgIcon,
    PostComponent,
    ReactiveFormsModule,
    Btn,
    Switch,
    Map,
    InfiniteScroll,
  ],
  viewProviders: [
    provideIcons({
      heroArrowPath,
      heroMagnifyingGlass,
      heroMapPin,
      heroPlus,
      heroFunnel,
      heroXMark,
      heroChevronDown,
    }),
  ],
  templateUrl: './main-page.html',
  styleUrl: './main-page.scss',
  host: { '(document:click)': 'closeSortMenu($event)' },
})
export class MainPage implements OnDestroy {
  private postService = inject(PostService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private location = inject(LocationService);
  private scroller = inject(ViewportScroller);
  authService = inject(AuthService);
  list = inject(PostListStore);

  searchControl = new FormControl('', { nonNullable: true });

  showFilters = signal(false);
  showSortMenu = signal(false);
  isMapView = signal(false);
  locationFailed = signal(false);

  sortOptions: { value: PostSortBy; labelKey: string }[] = [
    { value: 'RECOMMENDED', labelKey: 'MAIN_PAGE.sortRecommended' },
    { value: 'RECENT', labelKey: 'MAIN_PAGE.sortRecent' },
    { value: 'POPULAR', labelKey: 'MAIN_PAGE.sortPopular' },
    { value: 'UPCOMING', labelKey: 'MAIN_PAGE.sortUpcoming' },
  ];

  filtersForm = new FormGroup({
    type: new FormControl(NO_FILTERS.type, { nonNullable: true }),
    tags: new FormControl(NO_FILTERS.tags, { nonNullable: true }),
    startsFrom: new FormControl(NO_FILTERS.startsFrom, { nonNullable: true }),
    startsTo: new FormControl(NO_FILTERS.startsTo, { nonNullable: true }),
    visibility: new FormControl(NO_FILTERS.visibility, { nonNullable: true }),
    status: new FormControl(NO_FILTERS.status, { nonNullable: true }),
    includePast: new FormControl(NO_FILTERS.includePast, { nonNullable: true }),
  });

  /** The applied search and filters, also what the map shows. */
  readonly activeFilters = signal<PostFilterParams>({});
  /** A sort the user chose. Without one, the list follows the search and filters. */
  private pickedSort = signal<PostsSort | null>(null);

  readonly currentSortBy = computed<PostSortBy>(() => {
    const noCriteria = Object.keys(this.activeFilters()).length === 0;
    return this.pickedSort() ?? (noCriteria ? 'RECOMMENDED' : 'RECENT');
  });
  readonly isFeed = computed(() => this.currentSortBy() === 'RECOMMENDED');
  readonly isNearMe = computed(() => {
    const query = this.list.query();
    return query?.kind === 'feed' && !!query.location;
  });
  readonly canLoadMore = computed(
    () => this.list.hasMore() && !this.list.loading() && !this.list.failed(),
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
    const restored = this.restoreView();
    this.postService.clearActivePost();

    afterNextRender(() => {
      if (restored) {
        this.scroller.scrollToPosition([0, restored.scrollY]);
      }
      this.ready.set(true);
    });

    // First open, and again if the store was cleared because the user changed.
    effect(() => {
      if (this.ready() && this.list.query() === null) {
        untracked(() => this.load());
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
    // The next page isn't scrolled by itself, and would otherwise open at the end of a long list.
    if (this.router.currentNavigation()?.trigger !== 'popstate') {
      this.scroller.scrollToPosition([0, 0]);
    }
  }

  applyControls(): void {
    this.changeList(() => this.activeFilters.set(this.readFilters()));
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

  goToAddPost(): void {
    this.router.navigate(['/addPost']);
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
    this.isMapView.set(isToggled);
    if (!isToggled && (this.listOutdated || this.list.query() === null)) {
      this.load();
    }
  }

  refresh(): void {
    this.scroller.scrollToPosition([0, 0]);
    this.list.refresh();
  }

  /** Asks only when tapped. If the user refuses, the feed stays exactly as it is. */
  async useMyLocation(): Promise<void> {
    this.locationFailed.set(false);
    const location = await this.location.request();
    if (!location) {
      this.locationFailed.set(true);
      return;
    }
    if (this.isFeed() && !this.isMapView()) {
      this.loadRun++;
      this.scroller.scrollToPosition([0, 0]);
      this.list.start({ kind: 'feed', location });
    }
  }

  /** Applies a change, and starts a new list only if it changes which list should be showing. */
  private changeList(change: () => void): void {
    const listKey = () => JSON.stringify([this.currentSortBy(), this.activeFilters()]);
    const before = listKey();
    change();
    if (listKey() !== before) {
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

  /** Uses the position only if it's already allowed and arrives quickly. See the contract's README. */
  private async startFeed(run: number): Promise<void> {
    const location = await this.location.currentIfAllowed(LOCATION_WAIT_MS);
    if (run === this.loadRun) {
      this.list.start({ kind: 'feed', ...(location && { location }) });
    }
  }

  private resetControls(): void {
    this.filtersForm.reset(NO_FILTERS, { emitEvent: false });
    this.searchControl.setValue('', { emitEvent: false });
  }

  private readFilters(): PostFilterParams {
    const search = this.searchControl.value.trim();
    const { type, tags, startsFrom, startsTo, visibility, status, includePast } =
      this.filtersForm.getRawValue();
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
    };
  }

  private saveView(): void {
    this.list.saveView({
      search: this.searchControl.value,
      filters: this.filtersForm.getRawValue(),
      pickedSort: this.pickedSort(),
      showFilters: this.showFilters(),
      isMapView: this.isMapView(),
      scrollY: this.scroller.getScrollPosition()[1],
    });
  }

  /** Puts the page back as it was left, and returns the view. Otherwise a new list will start. */
  private restoreView(): PostListView | null {
    const navigation = this.router.currentNavigation();
    const comingBack =
      navigation?.trigger === 'popstate' || !!navigation?.extras.state?.['restoreList'];
    const view = comingBack ? this.list.savedView() : null;
    if (!view) {
      this.list.clear();
      return null;
    }

    this.searchControl.setValue(view.search, { emitEvent: false });
    this.filtersForm.setValue(view.filters as FilterValues, { emitEvent: false });
    this.pickedSort.set(view.pickedSort);
    this.showFilters.set(view.showFilters);
    this.isMapView.set(view.isMapView);
    this.activeFilters.set(this.readFilters());

    const post = this.postService.activePost();
    if (post) {
      this.list.updateItem(post);
    }
    return view;
  }
}
