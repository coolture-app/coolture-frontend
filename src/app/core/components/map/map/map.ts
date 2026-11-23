import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLocateFixed } from '@ng-icons/lucide';
import { Subject, debounceTime, throttleTime, asyncScheduler } from 'rxjs';
import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  MapLibreEvent,
  MapMouseEvent,
} from 'maplibre-gl';
import {
  MapComponent as MglMapComponent,
  PopupComponent,
  GeoJSONSourceComponent,
  LayerComponent,
} from '@maplibre/ngx-maplibre-gl';
import { FeatureCollection, Feature, Point, Polygon } from 'geojson';
import { PostFilterParams } from '../../../models/posts/post-filter-params.model';
import { PostMark } from '../../../models/posts/post-mark.model';
import { collapseCredit, followLanguage, MAP_STYLE, quietMissingIcons } from '../map-style';
import {
  areaInView,
  boundsOf,
  circle,
  fitPin,
  MapArea,
  outside,
  pointData,
  padded,
  ringPoints,
  startStep,
  toBox,
} from '../map-geometry';
import { MapMarks } from '../map-marks';
import { groupPlaces, hoverText, pinFeatures, PinWords, Place, pluralForm } from '../map-pins';
import * as layers from '../map-layers';
import { MapMemory } from '../map-memory';
import { MapPreview } from '../map-preview/map-preview';
import { PickStar } from '../pick-star/pick-star';
import { GeoPoint, TRICITY } from '../../../models/common/geo.model';
import { LocationService } from '../../../services/location/location.service';
import { ToastService } from '../../../services/toast/toast.service';
import { mediaQuery, WIDE_FROM_PX } from '../../../services/media-query/media-query';

/** Gdynia to Gdańsk in view, so the first look at an unknown user's map shows the whole release area. */
const TRICITY_ZOOM = 10;
const HOME_ZOOM = 12;
const POSITION_ZOOM = 13;
const POSITION_WAIT_MS = 1500;
/** A pin tapped from further out than this brings the map in to `PIN_ZOOM`. */
const FAR_ZOOM = 13;
const PIN_ZOOM = 14;
const FOCUS_ZOOM = 15;
const EASE_MS = 500;
/** The start shows at least this many pins, looking as far out as it takes. */
const START_PINS = 1;
/** A selected pin and its card keep this far from the map's edges and the sheet. */
const FIT_MARGIN_PX = 32;
/** Between a pin and its card on wide screens. */
const CARD_GAP_PX = 18;
/** A cluster tap zooms at least this far in, and no further than `MAX_TAP_ZOOM`. */
const MIN_TAP_ZOOM_STEP = 1.5;
const MAX_TAP_ZOOM = 18;
/** Marks the start's own moves, as MapLibre hands it to their `moveend`: any other move ends the start. */
const START_MOVE = { startMove: true };

type StartFrom = 'tricity' | 'home' | 'position';
const START_ZOOM: Record<StartFrom, number> = {
  tricity: TRICITY_ZOOM,
  home: HOME_ZOOM,
  position: POSITION_ZOOM,
};

@Component({
  selector: 'app-map',
  imports: [
    MglMapComponent,
    PopupComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    MapPreview,
    PickStar,
    TranslatePipe,
    NgIcon,
  ],
  viewProviders: [provideIcons({ lucideLocateFixed })],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--map-top-inset.px]': 'topInset()' },
})
export class Map {
  private store = inject(MapMarks);
  private location = inject(LocationService);
  private translate = inject(TranslateService);
  private memory = inject(MapMemory);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  readonly mapStyle = MAP_STYLE;
  readonly layers = layers;
  readonly cardGap = CARD_GAP_PX;

  filters = input<PostFilterParams>({});
  /** The feed's tab: leave out what the feed leaves out, so the map shows the same posts as the list. */
  excludeMine = input(false);
  /** Where the user lives, where the map starts when the browser gives no position. */
  home = input<GeoPoint | null>(null);
  /** The feed's top picks on Dla Ciebie, lit in the accent. Null on Wszystkie, where every pin looks the same. */
  picks = input<ReadonlySet<string> | null>(null);
  /** A post to open the map on, from the place on its card. */
  focus = input<PostMark | null>(null);
  /** Back from a post: open where the map was left, with the same pin open. */
  resume = input(false);
  /** Lista hides the map instead of destroying it, so its style and tiles stay loaded. */
  visible = input(true);
  /** How much of the map's top a bar floats over, on phones. The map's own buttons and its middle sit below it. */
  topInset = input(0);
  /** The user tapped "Szukaj w tym obszarze". */
  searchArea = output<MapArea>();

  /** Where the map opens. Inputs aren't set yet here, so `onMapLoad` moves on to the home or the position. */
  readonly start = {
    center: [TRICITY.longitude, TRICITY.latitude] as [number, number],
    zoom: TRICITY_ZOOM,
  };
  /** The user moved the map since its last area was set, so a search in the new view is offered. */
  readonly moved = signal(false);
  /** The area this map handed over is loading; its button stays up with a spinner until the pins arrive. */
  readonly searching = signal(false);
  readonly loading = this.store.loading;
  readonly locating = signal(false);
  /** The precise position after "Moja lokalizacja", drawn as a dot. It never leaves the browser. */
  readonly here = signal<GeoPoint | null>(null);
  /** Wide screens open a pin's preview by the pin and show a title on hover; phones use a sheet at the bottom. */
  readonly wide = mediaQuery(`(min-width: ${WIDE_FROM_PX}px)`);
  readonly hoverable = mediaQuery('(hover: hover)');

  /** The post the map was opened on, shown even when the filters leave it out. */
  private readonly focused = signal<PostMark | null>(null);
  /** Any post of the selected place, so the selection survives a place's id changing when a sooner post joins. */
  private readonly selectedPost = signal<string | null>(null);
  /** The post opened from the selected place's list. */
  readonly opened = signal<string | null>(null);
  readonly hovered = signal<Place | null>(null);

  // The pins read `today`, `tomorrow`, `now`, `from`, `todayFrom` and `tomorrowFrom` of MAP by name, so a search for
  // `MAP.today` finds no use.
  private readonly words = toSignal(this.translate.stream('MAP'), { initialValue: {} });
  readonly places = computed(() => {
    const focused = this.focused();
    const marks = this.store.marks();
    return groupPlaces(
      focused && !marks.some((m) => m.id === focused.id) ? [...marks, focused] : marks,
    );
  });
  readonly pins = computed<FeatureCollection<Point>>(() =>
    pinFeatures(
      this.places(),
      this.picks(),
      new Date(),
      this.translate.getCurrentLang() || 'pl',
      this.words() as PinWords,
    ),
  );
  readonly hoverInfo = computed(() => {
    const place = this.hovered();
    const locale = this.translate.getCurrentLang() || 'pl';
    return (
      place &&
      hoverText(place, new Date(), locale, this.words() as PinWords, (count) =>
        this.translate.instant(`MAP.events_${pluralForm(count, locale)}`, { count }),
      )
    );
  });

  readonly selected = computed(() => {
    const id = this.selectedPost();
    return id ? (this.places().find((p) => p.posts.some((post) => post.id === id)) ?? null) : null;
  });
  readonly litFilter = computed<FilterSpecification>(() => [
    'all',
    layers.IS_PIN,
    ['==', ['get', 'id'], this.selected()?.id ?? ''],
  ]);
  readonly hereData = computed(() => pointData(this.here()));

  /** The location filter's area, drawn over the map. */
  readonly radiusArea = computed(() => {
    const { latitude, longitude, radiusKm } = this.filters();
    return latitude !== undefined && longitude !== undefined && radiusKm
      ? circle(latitude, longitude, radiusKm)
      : null;
  });

  /** The world with the area cut out, dimmed so the searched area reads as the bright part. */
  readonly outsideArea = computed(() => {
    const area = this.radiusArea();
    return area ? outside(area) : null;
  });

  /**
   * Set once MapLibre has loaded; nothing on the map is touched before. Not a signal on purpose: the effects act on
   * changes after load, and `onMapLoad` applies the first values in an order Back from a post depends on.
   */
  private map: MapLibreMap | null = null;
  /** The area this map handed over itself. It's already in view, so the map doesn't fit to it. */
  private handedOver: MapArea | null = null;
  private fittedArea: Feature<Polygon> | null = null;
  /** Something changed while Lista hid the map, so it fetches when shown. */
  private stale = false;
  /**
   * Where the start put the camera, until a move not its own or a selected pin. A home or a position known only later
   * may still move it.
   */
  private startedAt: StartFrom | null = null;
  /** The start shows fewer than `START_PINS` pins and asks for boxes `startReach` views wider on each side. */
  private findingPin = false;
  private startReach = 0;
  /** Only the latest selection's fit runs. */
  private fitRun = 0;

  private boundsChange$ = new Subject<void>();
  private moving$ = new Subject<void>();

  constructor() {
    effect(() => {
      this.filters();
      this.excludeMine();
      const area = this.radiusArea();
      const map = this.map;
      untracked(() => this.moved.set(false));
      if (area && this.isFilter(this.handedOver)) {
        this.fittedArea = area;
      }
      if (map && area && this.fittedArea !== area) {
        this.fitTo(map, area);
      } else if (map) {
        untracked(() => this.fetchForView());
      }
    });

    effect(() => {
      const post = this.focus();
      const map = this.map;
      if (post && map) {
        // A map hidden under Lista has no size yet, and a post centred in it would land in a corner once shown.
        const shown = map.getContainer().clientWidth > 0;
        requestAnimationFrame(() => {
          map.resize();
          this.showFocus(map, post, shown);
        });
      }
    });

    effect(() => {
      if (this.visible() && this.map) {
        const map = this.map;
        // The container had no size while hidden.
        requestAnimationFrame(() => map.resize());
        if (this.stale) {
          untracked(() => this.fetchForView());
        }
      }
    });

    effect(() => {
      const place = this.selected();
      this.opened();
      untracked(() => this.remember(place));
    });

    // `/auth/me` can answer after the map opened over Trójmiasto.
    effect(() => {
      const home = this.home();
      untracked(() => {
        if (home && this.map && this.startedAt === 'tricity') {
          this.beginStart(this.map, 'home', home);
        }
      });
    });

    effect(() => {
      const top = this.topInset();
      this.map?.setPadding({ top, right: 0, bottom: 0, left: 0 });
    });

    this.boundsChange$
      .pipe(debounceTime(100), takeUntilDestroyed())
      .subscribe(() => this.fetchForView());

    // While the map moves, pins ahead of it load before the view gets there.
    this.moving$
      .pipe(
        throttleTime(250, asyncScheduler, { leading: true, trailing: true }),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.fetchForView());

    this.store.settled.pipe(takeUntilDestroyed()).subscribe(() => {
      this.searching.set(false);
      this.findStartPin();
    });
  }

  onMapLoad(map: MapLibreMap): void {
    // Read first: `setPadding` is a jump, and its move's end remembers the view it starts from.
    const view = this.resume() ? this.memory.view : null;
    if (!view) {
      this.store.forget();
    }
    this.map = map;
    map.setPadding({ top: this.topInset(), right: 0, bottom: 0, left: 0 });
    map.on('move', () => this.moving$.next());
    collapseCredit(map);
    quietMissingIcons(map);
    const labels = followLanguage(map, this.translate);
    this.destroyRef.onDestroy(() => labels.unsubscribe());
    layers.addPillImages(map);
    layers.addKindImages(map);
    const focus = this.focus();
    if (focus) {
      this.showFocus(map, focus, false);
      return;
    }
    if (view) {
      map.jumpTo({ center: view.center, zoom: view.zoom });
      this.selectedPost.set(view.selected);
      this.opened.set(view.opened);
      this.fetchForView();
      return;
    }
    const area = this.radiusArea();
    const home = this.home();
    if (area) {
      this.fitTo(map, area);
    } else {
      this.beginStart(map, home ? 'home' : 'tricity', home);
      void this.startAtPosition(map);
    }
  }

  /**
   * MapLibre asks again for the pills if a style reload dropped them, and for the icon of a kind the frontend doesn't
   * know yet, which gets a plain one.
   */
  onImageMissing(id: string): void {
    if (this.map && !layers.addKindImage(this.map, id)) {
      layers.addPillImages(this.map);
    }
  }

  /** The browser's position beats the home and Trójmiasto, if it's already allowed and the user hasn't moved yet. */
  private async startAtPosition(map: MapLibreMap): Promise<void> {
    const position = await this.location.currentIfAllowed(POSITION_WAIT_MS);
    if (position && this.startedAt) {
      this.beginStart(map, 'position', position);
    }
  }

  private beginStart(map: MapLibreMap, from: StartFrom, at: GeoPoint | null): void {
    if (at) {
      map.jumpTo({ center: [at.longitude, at.latitude], zoom: START_ZOOM[from] }, START_MOVE);
    }
    // The pins of an earlier start would count as the nearest.
    this.store.forget();
    this.startedAt = from;
    this.findingPin = true;
    this.startReach = 0;
    this.fetchForView();
  }

  private endStart(): void {
    this.startedAt = null;
    this.findingPin = false;
  }

  private showFocus(map: MapLibreMap, post: PostMark, animate: boolean): void {
    this.focused.set(post);
    this.select(post.id);
    // A pin on several posts opens on this one.
    this.opened.set(post.id);
    map.once('moveend', () => this.fitSelected(false, animate ? EASE_MS : 0));
    map.easeTo({
      center: [post.coordinates.longitude, post.coordinates.latitude],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      duration: animate ? EASE_MS : 0,
      essential: true,
    });
    this.fetchForView();
  }

  onSearchArea(): void {
    const map = this.map!;
    const { lat, lng } = map.getCenter();
    // The top edge of what isn't under a floating bar.
    const top = map.unproject([map.getCanvas().clientWidth / 2, this.topInset()]);
    const area = areaInView({ latitude: lat, longitude: lng }, top.lat, map.getBounds().getEast());
    this.moved.set(false);
    // The same area again changes no filter, so nothing would load and end the spinner.
    this.searching.set(!this.isFilter(area));
    this.handedOver = area;
    this.searchArea.emit(area);
  }

  /** "Moja lokalizacja". The browser is asked only when the user taps it, then the position shows as a dot. */
  async locate(): Promise<void> {
    this.locating.set(true);
    const position = await this.location.request();
    this.locating.set(false);
    const at = this.location.precisePosition() ?? position;
    if (!at || !this.map) {
      this.toast.show(this.translate.instant('MAP.locateFailed'));
      return;
    }
    this.here.set(at);
    this.map.easeTo({
      center: [at.longitude, at.latitude],
      zoom: Math.max(this.map.getZoom(), PIN_ZOOM),
      duration: EASE_MS,
      essential: true,
    });
  }

  onPinClick(event: MapLayerMouseEvent): void {
    const id = event.features?.[0]?.properties?.['id'];
    const place = this.places().find((p) => p.id === id);
    if (!place || !this.map) {
      return;
    }
    this.select(place.posts[0].id);
    this.hovered.set(null);
    this.fitSelected(true);
  }

  /**
   * Moves the map only as far as the selected pin and its card need to be in view, once the card is drawn and its
   * size known. From far out it also zooms in, around the pin.
   */
  fitSelected(zoomIn: boolean, duration = EASE_MS): void {
    const run = ++this.fitRun;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const map = this.map;
        const place = this.selected();
        if (run !== this.fitRun || !map || !place) {
          return;
        }
        const container = map.getContainer();
        const width = container.clientWidth;
        const height = container.clientHeight;
        const card = container.querySelector('.map-card .maplibregl-popup-content');
        const sheet = container.closest('.map-wrapper')?.querySelector('.map-sheet');
        const bottom = sheet
          ? sheet.getBoundingClientRect().top - container.getBoundingClientRect().top
          : height;
        const at: [number, number] = [place.coordinates.longitude, place.coordinates.latitude];
        const pin = map.project(at);
        const { dx, dy } = fitPin(
          pin,
          { left: 0, top: this.topInset(), right: width, bottom },
          card?.getBoundingClientRect().height ?? 0,
          FIT_MARGIN_PX,
          CARD_GAP_PX,
        );
        const zoom = zoomIn && map.getZoom() < FAR_ZOOM ? PIN_ZOOM : map.getZoom();
        if (!dx && !dy && zoom === map.getZoom()) {
          return;
        }
        // The pin ends up where it is now, moved by the fit; zooming in keeps it there.
        const centre = map.project(map.getCenter());
        map.easeTo({
          center: at,
          zoom,
          offset: [pin.x + dx - centre.x, pin.y + dy - centre.y],
          duration,
          essential: true,
        });
      }),
    );
  }

  onClusterClick(event: MapLayerMouseEvent): void {
    const feature = event.features?.[0];
    const map = this.map;
    if (!feature || !map) {
      return;
    }
    const center = (feature.geometry as Point).coordinates as [number, number];
    const source = map.getSource<GeoJSONSource>('posts');
    void source?.getClusterExpansionZoom(feature.properties['cluster_id']).then((zoom) => {
      // A split one level in reads as the pins jumping rather than a zoom, so it goes at least a bit further.
      map.easeTo({
        center,
        zoom: Math.min(MAX_TAP_ZOOM, Math.max(zoom, map.getZoom() + MIN_TAP_ZOOM_STEP)),
        duration: EASE_MS,
        essential: true,
      });
    });
  }

  /** A tap on the map itself, not on a pin, closes the preview. */
  onMapClick({ point }: MapMouseEvent): void {
    const hit = this.map?.queryRenderedFeatures(point, { layers: ['pins', 'lit', 'clusters'] });
    if (!hit?.length) {
      this.select(null);
    }
  }

  onPinEnter(event: MapLayerMouseEvent): void {
    if (this.map) {
      this.map.getCanvas().style.cursor = 'pointer';
    }
    if (this.hoverable()) {
      const id = event.features?.[0]?.properties?.['id'];
      this.hovered.set(this.places().find((p) => p.id === id) ?? null);
    }
  }

  onPinLeave(): void {
    if (this.map) {
      this.map.getCanvas().style.cursor = '';
    }
    this.hovered.set(null);
  }

  closePreview(): void {
    this.select(null);
  }

  private select(postId: string | null): void {
    // A pin whose card already fits moves nothing, so its tap would not end the start.
    this.endStart();
    this.selectedPost.set(postId);
    this.opened.set(null);
  }

  onMoveEnd(event: MapLibreEvent<Event | undefined> & Partial<typeof START_MOVE>): void {
    // Only the user's own gestures carry an original event; fitting the radius or the start doesn't.
    if (event.originalEvent) {
      this.moved.set(true);
    }
    if (!event.startMove) {
      this.endStart();
    }
    this.remember(this.selected());
    this.boundsChange$.next();
  }

  private remember(place: Place | null): void {
    const map = this.map;
    if (map) {
      const { lng, lat } = map.getCenter();
      this.memory.view = {
        center: [lng, lat],
        zoom: map.getZoom(),
        selected: place?.posts[0].id ?? null,
        opened: this.opened(),
      };
    }
  }

  /** The pins for the view, or for a box `views` wider on each side. */
  private fetchForView(views = 0): void {
    const map = this.map;
    if (!map) {
      return;
    }
    if (!this.visible()) {
      this.stale = true;
      return;
    }
    this.stale = false;
    const asked = this.store.load(padded(toBox(map.getBounds()), views), {
      filters: this.filters(),
      excludeMine: this.excludeMine(),
    });
    if (!asked) {
      this.searching.set(false);
    }
  }

  /** Frames the start and its nearest pins, once a box wide enough has them. Never zooms in. */
  private findStartPin(): void {
    const map = this.map;
    if (!this.findingPin || !map) {
      return;
    }
    const view = toBox(map.getBounds());
    const { lng, lat } = map.getCenter();
    const step = startStep(view, { latitude: lat, longitude: lng }, this.store.marks(), START_PINS);
    // Until the box last asked for spans the world.
    if (step === 'wider' && (view.east - view.west) * (2 * this.startReach + 1) < 360) {
      this.startReach = this.startReach * 4 || 4;
      this.fetchForView(this.startReach);
      return;
    }
    this.findingPin = false;
    if (Array.isArray(step)) {
      map.fitBounds(
        boundsOf(step),
        // The nearest pin may join a cluster, whose middle can be the clustering radius away from it.
        {
          padding: layers.CLUSTER_SOURCE.radius + FIT_MARGIN_PX,
          maxZoom: map.getZoom(),
          duration: EASE_MS,
        },
        START_MOVE,
      );
    }
  }

  private isFilter(area: MapArea | null): boolean {
    const { latitude, longitude, radiusKm } = this.filters();
    return (
      !!area &&
      area.centre.latitude === latitude &&
      area.centre.longitude === longitude &&
      area.radiusKm === radiusKm
    );
  }

  /** The move's end fetches the markers for the new view. */
  private fitTo(map: MapLibreMap, area: Feature<Polygon>): void {
    this.fittedArea = area;
    map.fitBounds(boundsOf(ringPoints(area)), { padding: 32, duration: 0 });
  }
}
