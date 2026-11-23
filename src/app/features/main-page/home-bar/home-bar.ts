import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroAdjustmentsHorizontal,
  heroChevronDown,
  heroMagnifyingGlass,
  heroMapPin,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { lucideRadio } from '@ng-icons/lucide';

import { Tooltip } from '../../../core/directives/tooltip';
import { NamedPlace } from '../../../core/models/common/geo.model';
import { mediaQuery, WIDE_FROM_PX } from '../../../core/services/media-query/media-query';
import { HomeTab, PlaceFilter } from '../home-view';
import { ViewSwitch } from '../view-switch/view-switch';

/** Near the top the bar stays, so it never hides with nothing under it. */
const ALWAYS_SHOWN_PX = 120;
/**
 * How long after the last scroll event the bar turns solid again. A mouse wheel sends separate
 * ticks with gaps of a few hundred ms, which shouldn't count as stopping.
 */
const SCROLL_STOP_MS = 1000;

/**
 * The home page's toolbar: the tabs, the search, the place pill, Filtry and Lista | Mapa. The page owns what they
 * change, and puts the open panel and the pull indicator inside, so they hang under the bar.
 */
@Component({
  selector: 'app-home-bar',
  imports: [ReactiveFormsModule, TranslatePipe, NgIcon, Tooltip, ViewSwitch],
  viewProviders: [
    provideIcons({
      heroAdjustmentsHorizontal,
      heroChevronDown,
      heroMagnifyingGlass,
      heroMapPin,
      heroXMark,
      lucideRadio,
    }),
  ],
  templateUrl: './home-bar.html',
  styleUrl: './home-bar.scss',
  host: {
    '[class.scrolling]': 'scrolling()',
    // Nothing scrolls on the map, so there the bar never slides away.
    '[class.hidden]': 'hidden() && !mapView()',
    '[class.over-map]': 'mapView()',
    '(window:scroll)': 'onScroll()',
    '(document:keydown.escape)': 'closePanels()',
  },
})
export class HomeBar {
  readonly search = input.required<FormControl<string>>();
  readonly feed = input.required<boolean>();
  readonly place = input.required<PlaceFilter>();
  readonly picked = input<NamedPlace | null>(null);
  readonly radiusKm = input<number>();
  readonly filterCount = input(0);
  readonly mapView = input(false);
  readonly filtersOpen = model(false);
  readonly placeOpen = model(false);
  readonly tabPicked = output<HomeTab>();
  /** Enter, or the search cleared, which apply at once rather than after the typing pause. */
  readonly searched = output<void>();
  readonly mapSwitched = output<boolean>();

  /** The picked place up to its first comma, "Śródmieście" of "Śródmieście, Gdynia", so the pill fits a phone. */
  readonly pickedShortName = computed(() => this.picked()?.name.split(',')[0].trim() ?? '');
  /** While the page moves the bar is see-through, and it turns solid once scrolling stops. */
  readonly scrolling = signal(false);
  /** Phones only, in the styles: the bar slides away while scrolling down, back on scrolling up. */
  readonly hidden = signal(false);
  private readonly height = signal(0);
  private readonly phone = mediaQuery(`(max-width: ${WIDE_FROM_PX - 1}px)`);
  /** On a phone's Mapa the bar floats over the map's top, so the map keeps its own buttons and middle below it. */
  readonly overlap = computed(() => (this.mapView() && this.phone() ? this.height() : 0));

  private lastScrollY = 0;
  private scrollStop: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => clearTimeout(this.scrollStop));
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.height.set(host.offsetHeight));
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  togglePlace(): void {
    this.filtersOpen.set(false);
    this.placeOpen.update((open) => !open);
  }

  toggleFilters(): void {
    this.placeOpen.set(false);
    this.filtersOpen.update((open) => !open);
  }

  closePanels(): void {
    this.filtersOpen.set(false);
    this.placeOpen.set(false);
  }

  clearSearch(): void {
    this.search().setValue('', { emitEvent: false });
    this.searched.emit();
  }

  onScroll(): void {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;
    if (y < ALWAYS_SHOWN_PX || delta < 0 || this.filtersOpen() || this.placeOpen()) {
      this.hidden.set(false);
    } else if (delta > 0) {
      this.hidden.set(true);
    }
    this.scrolling.set(true);
    clearTimeout(this.scrollStop);
    this.scrollStop = setTimeout(() => this.scrolling.set(false), SCROLL_STOP_MS);
  }
}
