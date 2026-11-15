import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLocateFixed } from '@ng-icons/lucide';
import { Subject, takeUntil, debounceTime, switchMap, tap, catchError, of } from 'rxjs';
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import {
  MapComponent as MglMapComponent,
  PopupComponent,
  GeoJSONSourceComponent,
  LayerComponent,
} from '@maplibre/ngx-maplibre-gl';
import { FeatureCollection, Feature, Point, Polygon } from 'geojson';
import { PostService } from '../../../services/post/post.service';
import { PostFilterParams } from '../../../models/posts/post-filter-params.model';
import { PostMark } from '../../../models/posts/post-mark.model';
import { MapBounds } from '../../../models/posts/map-bounds.model';
import { collapseCredit, MAP_STYLE, TRICITY } from '../map-style';
import { groupPlaces, pinFeatures, PinWords, Place } from '../map-pins';
import * as layers from '../map-layers';
import { MapMemory } from '../map-memory';
import { MapPreview } from '../map-preview/map-preview';
import { GeoPoint } from '../../../models/common/geo.model';
import { haversineMeters, LocationService } from '../../../services/location/location.service';
import { ToastService } from '../../../services/toast/toast.service';

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
/** The start eases out until this many pins show, but never wider than `WIDEST_START_ZOOM`. */
const START_PINS = 3;
const WIDEST_START_ZOOM = 9;
/** On a phone the preview covers the bottom of the map, so a tapped pin settles this far above the middle. */
const PHONE_PIN_LIFT_PX = 110;
const PIN_LAYERS = ['pins', 'lit'];

/** What "Szukaj w tym obszarze" hands over: the circle inside the view, touching its nearer edges. */
export interface MapArea {
  centre: GeoPoint;
  /** Whole km, at least 1. */
  radiusKm: number;
}

interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

@Component({
  selector: 'app-map',
  imports: [
    MglMapComponent,
    PopupComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    MapPreview,
    TranslatePipe,
    NgIcon,
  ],
  viewProviders: [provideIcons({ lucideLocateFixed })],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Map implements OnDestroy {
  private postService = inject(PostService);
  private location = inject(LocationService);
  private translate = inject(TranslateService);
  private memory = inject(MapMemory);
  private toast = inject(ToastService);

  readonly mapStyle = MAP_STYLE;
  readonly layers = layers;
  readonly clusterPosts = CLUSTER_POSTS;

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
  readonly loading = signal(false);
  readonly locating = signal(false);
  /** The precise position after "Moja lokalizacja", drawn as a dot. It never leaves the browser. */
  readonly here = signal<GeoPoint | null>(null);
  /** Wide screens open a pin's preview by the pin and show a title on hover; phones use a sheet at the bottom. */
  readonly wide = signal(matches('(min-width: 640px)'));
  readonly hoverable = matches('(hover: hover)');

  private readonly marks = signal<PostMark[]>([]);
  /** The post the map was opened on, shown even when the filters leave it out. */
  private readonly focused = signal<PostMark | null>(null);
  /** Any post of the selected place, so the selection survives a place's id changing when a sooner post joins. */
  private readonly selectedPost = signal<string | null>(null);
  readonly hovered = signal<Place | null>(null);

  private readonly words = toSignal(this.translate.stream('MAP'), { initialValue: {} });
  readonly places = computed(() => {
    const focused = this.focused();
    const marks = this.marks();
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
  readonly selected = computed(() => {
    const id = this.selectedPost();
    return id ? (this.places().find((p) => p.posts.some((post) => post.id === id)) ?? null) : null;
  });
  readonly litFilter = computed<FilterSpecification>(() => [
    'all',
    ['!', ['has', 'point_count']],
    ['==', ['get', 'id'], this.selected()?.id ?? ''],
  ]);
  readonly hereData = computed<FeatureCollection<Point>>(() => {
    const at = this.here();
    return {
      type: 'FeatureCollection',
      features: at
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: [at.longitude, at.latitude] },
            },
          ]
        : [],
    };
  });

  /** The location filter's area, drawn over the map. */
  readonly radiusArea = computed(() => {
    const { latitude, longitude, radiusKm } = this.filters();
    return latitude !== undefined && longitude !== undefined && radiusKm
      ? circle(latitude, longitude, radiusKm)
      : null;
  });

  /** The world with the area cut out, dimmed so the searched area reads as the bright part. */
  readonly outsideArea = computed<Feature<Polygon> | null>(() => {
    const area = this.radiusArea();
    return area
      ? {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [WORLD, ...area.geometry.coordinates] },
        }
      : null;
  });

  /** Set once MapLibre has loaded; nothing on the map is touched before. */
  private map: MapLibreMap | null = null;
  /** The area this map handed over itself. It's already in view, so the map doesn't fit to it. */
  private handedOver: MapArea | null = null;
  private fittedArea: Feature<Polygon> | null = null;
  /** What the pins on screen were fetched for: a box around the view, and the filters. */
  private loaded: { box: Box; key: string } | null = null;
  /** Something changed while Lista hid the map, so it fetches when shown. */
  private stale = false;
  /** The first view is still easing out to show `START_PINS` pins. */
  private easingOut = false;

  private destroy$ = new Subject<void>();
  private boundsChange$ = new Subject<void>();
  private marksWanted$ = new Subject<Box>();

  constructor() {
    effect(() => {
      this.filters();
      this.excludeMine();
      const area = this.radiusArea();
      const map = this.map;
      untracked(() => this.moved.set(false));
      if (area && this.isHandedOver()) {
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
        untracked(() => this.showFocus(map, post, true));
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
      untracked(() => this.remember(place));
    });

    this.boundsChange$
      .pipe(debounceTime(100), takeUntil(this.destroy$))
      .subscribe(() => this.fetchForView());

    // A newer view or filter cancels the request still running, so an older answer never replaces newer pins.
    // The pins on screen stay until the answer arrives; a failed one keeps them.
    this.marksWanted$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((box) =>
          this.postService.getMapMarks(this.filters(), toMapBounds(box), this.excludeMine()).pipe(
            catchError(() => {
              this.loaded = null;
              return of(null);
            }),
          ),
        ),
        tap(() => {
          this.loading.set(false);
          this.searching.set(false);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((marks) => {
        if (marks) {
          this.marks.set(marks);
          this.easeOutIfEmpty();
        }
      });

    if (typeof window !== 'undefined') {
      const query = window.matchMedia('(min-width: 640px)');
      const onChange = () => this.wide.set(query.matches);
      query.addEventListener('change', onChange);
      this.destroy$.subscribe(() => query.removeEventListener('change', onChange));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMapLoad(map: MapLibreMap): void {
    this.map = map;
    collapseCredit(map);
    layers.addPillImages(map);
    const focus = this.focus();
    const view = this.resume() ? this.memory.view : null;
    if (focus) {
      this.showFocus(map, focus, false);
      return;
    }
    if (view) {
      map.jumpTo({ center: view.center, zoom: view.zoom });
      this.selectedPost.set(view.selected);
      this.fetchForView();
      return;
    }
    const home = this.home();
    if (home && !this.radiusArea()) {
      map.jumpTo({ center: [home.longitude, home.latitude], zoom: HOME_ZOOM });
    }
    const area = this.radiusArea();
    if (area) {
      this.fitTo(map, area);
    } else {
      this.easingOut = true;
      this.fetchForView();
      void this.startAtPosition(map);
    }
  }

  /** MapLibre asks again for the pills if a style reload dropped them. */
  onImageMissing(): void {
    if (this.map) {
      layers.addPillImages(this.map);
    }
  }

  /** The browser's position beats the home and Trójmiasto, if it's already allowed and the user hasn't moved yet. */
  private async startAtPosition(map: MapLibreMap): Promise<void> {
    const position = await this.location.currentIfAllowed(POSITION_WAIT_MS);
    if (position && !this.moved() && !this.radiusArea() && !this.selectedPost()) {
      map.jumpTo({ center: [position.longitude, position.latitude], zoom: POSITION_ZOOM });
    }
  }

  private showFocus(map: MapLibreMap, post: PostMark, animate: boolean): void {
    this.easingOut = false;
    this.focused.set(post);
    this.selectedPost.set(post.id);
    const center: [number, number] = [post.coordinates.longitude, post.coordinates.latitude];
    const zoom = Math.max(map.getZoom(), FOCUS_ZOOM);
    if (animate) {
      map.easeTo({ center, zoom, duration: EASE_MS, offset: this.pinOffset() });
    } else {
      map.jumpTo({ center, zoom });
    }
    this.fetchForView();
  }

  onSearchArea(): void {
    const map = this.map!;
    const centre = map.getCenter();
    const bounds = map.getBounds();
    const at = { latitude: round(centre.lat), longitude: round(centre.lng) };
    const toEdgeKm =
      Math.min(
        haversineMeters(at, { latitude: bounds.getNorth(), longitude: at.longitude }),
        haversineMeters(at, { latitude: at.latitude, longitude: bounds.getEast() }),
      ) / 1000;
    const area = { centre: at, radiusKm: Math.max(1, Math.round(toEdgeKm)) };
    this.moved.set(false);
    // The same area again changes no filter, so nothing would load and end the spinner.
    this.searching.set(!this.isFilter(area));
    this.handedOver = area;
    this.searchArea.emit(area);
  }

  /** "Moja lokalizacja": asks the browser only now, then shows where the user is. */
  async locate(): Promise<void> {
    this.locating.set(true);
    const position = await this.location.request();
    this.locating.set(false);
    const at = this.location.precisePosition() ?? position;
    if (!at || !this.map) {
      this.toast.show(this.translate.instant('MAP.locateFailed'));
      return;
    }
    this.easingOut = false;
    this.here.set(at);
    this.map.easeTo({
      center: [at.longitude, at.latitude],
      zoom: Math.max(this.map.getZoom(), PIN_ZOOM),
      duration: EASE_MS,
    });
  }

  onPinClick(event: MapLayerMouseEvent): void {
    const id = event.features?.[0]?.properties?.['id'];
    const place = this.places().find((p) => p.id === id);
    if (!place || !this.map) {
      return;
    }
    this.easingOut = false;
    this.selectedPost.set(place.posts[0].id);
    this.hovered.set(null);
    const zoom = this.map.getZoom();
    this.map.easeTo({
      center: [place.coordinates.longitude, place.coordinates.latitude],
      zoom: zoom < FAR_ZOOM ? PIN_ZOOM : zoom,
      duration: EASE_MS,
      offset: this.pinOffset(),
    });
  }

  onClusterClick(event: MapLayerMouseEvent): void {
    const feature = event.features?.[0];
    const map = this.map;
    if (!feature || !map) {
      return;
    }
    this.easingOut = false;
    const center = (feature.geometry as Point).coordinates as [number, number];
    const source = map.getSource<GeoJSONSource>('posts');
    void source?.getClusterExpansionZoom(feature.properties['cluster_id']).then((zoom) => {
      map.easeTo({ center, zoom, duration: EASE_MS });
    });
  }

  /** A tap on the map itself, not on a pin, closes the preview. */
  onMapClick(event: unknown): void {
    const { point } = event as { point: [number, number] };
    const hit = this.map?.queryRenderedFeatures(point, { layers: [...PIN_LAYERS, 'clusters'] });
    if (!hit?.length) {
      this.selectedPost.set(null);
    }
  }

  onPinEnter(event: MapLayerMouseEvent): void {
    if (this.map) {
      this.map.getCanvas().style.cursor = 'pointer';
    }
    if (this.hoverable) {
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
    this.selectedPost.set(null);
  }

  onMoveEnd(event: unknown): void {
    const { originalEvent } = event as { originalEvent?: Event };
    // Only the user's own gestures carry an original event; fitting the radius or the start doesn't.
    if (originalEvent) {
      this.moved.set(true);
      this.easingOut = false;
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
      };
    }
  }

  private pinOffset(): [number, number] {
    return this.wide() ? [0, 0] : [0, -PHONE_PIN_LIFT_PX];
  }

  /** Fetches a box one view wider on each side, so panning nearby needs no request. */
  private fetchForView(): void {
    const map = this.map;
    if (!map) {
      return;
    }
    if (!this.visible()) {
      this.stale = true;
      return;
    }
    this.stale = false;
    const view = toBox(map.getBounds());
    const key = JSON.stringify([this.filters(), this.excludeMine()]);
    if (this.loaded && this.loaded.key === key && contains(this.loaded.box, view)) {
      if (this.searching()) {
        this.searching.set(false);
      }
      return;
    }
    const box = padded(view);
    this.loaded = { box, key };
    this.marksWanted$.next(box);
  }

  /** At the start, a view with fewer than `START_PINS` pins eases out to the nearest ones. */
  private easeOutIfEmpty(): void {
    const map = this.map;
    if (!this.easingOut || !map || this.moved()) {
      return;
    }
    const view = toBox(map.getBounds());
    const marks = this.marks();
    if (marks.filter((m) => inBox(view, m.coordinates)).length >= START_PINS) {
      this.easingOut = false;
      return;
    }
    const { lng, lat } = map.getCenter();
    const centre = { latitude: lat, longitude: lng };
    const nearest = [...marks]
      .sort(
        (a, b) => haversineMeters(centre, a.coordinates) - haversineMeters(centre, b.coordinates),
      )
      .slice(0, START_PINS);
    if (nearest.length < START_PINS) {
      // Nothing more is loaded around this view, so look wider and check again on the answer.
      if (map.getZoom() - 2 >= WIDEST_START_ZOOM) {
        map.easeTo({ zoom: map.getZoom() - 2, duration: EASE_MS });
      } else {
        this.easingOut = false;
      }
      return;
    }
    this.easingOut = false;
    const points = [centre, ...nearest.map((m) => m.coordinates)];
    const camera = map.cameraForBounds(
      [
        [Math.min(...points.map((p) => p.longitude)), Math.min(...points.map((p) => p.latitude))],
        [Math.max(...points.map((p) => p.longitude)), Math.max(...points.map((p) => p.latitude))],
      ],
      { padding: 48 },
    );
    if (camera?.zoom !== undefined) {
      map.easeTo({
        center: [lng, lat],
        zoom: Math.max(WIDEST_START_ZOOM, Math.min(map.getZoom(), camera.zoom)),
        duration: EASE_MS,
      });
    }
  }

  private isHandedOver(): boolean {
    return this.isFilter(this.handedOver);
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
    const ring = area.geometry.coordinates[0];
    const lngs = ring.map(([lng]) => lng);
    const lats = ring.map(([, lat]) => lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 32, duration: 0 },
    );
  }
}

const EARTH_RADIUS_KM = 6371;

/** Wound the other way from `circle`'s ring, so MapLibre reads the circle as a hole in it. */
const WORLD = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

/** The clusters' count is of posts, not of places. */
export const CLUSTER_POSTS: Record<string, ExpressionSpecification> = {
  posts: ['+', ['get', 'count']],
};

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

function toBox(bounds: {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}): Box {
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

function padded({ west, south, east, north }: Box): Box {
  const width = east - west;
  const height = north - south;
  return { west: west - width, south: south - height, east: east + width, north: north + height };
}

function contains(outer: Box, inner: Box): boolean {
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  );
}

function inBox(box: Box, { latitude, longitude }: GeoPoint): boolean {
  return (
    longitude >= box.west && longitude <= box.east && latitude >= box.south && latitude <= box.north
  );
}

/** The box, kept inside the world's limits. */
function toMapBounds({ west, south, east, north }: Box): MapBounds {
  if (east - west >= 360) {
    west = -180;
    east = 180;
  } else {
    west = clamp(west, 180);
    east = clamp(east, 180);
  }
  return {
    leftUpper: { latitude: clamp(north, 90), longitude: west },
    rightBottom: { latitude: clamp(south, 90), longitude: east },
  };
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/** About 110 m: enough for a radius's centre, and a short link. */
function round(coordinate: number): number {
  return Math.round(coordinate * 1000) / 1000;
}

/** A circle on the map as a 64-sided polygon, close enough at city scale. */
function circle(latitude: number, longitude: number, radiusKm: number): Feature<Polygon> {
  const angular = radiusKm / EARTH_RADIUS_KM;
  const lat = (latitude * Math.PI) / 180;
  const lng = (longitude * Math.PI) / 180;
  const ring = Array.from({ length: 65 }, (_, i) => {
    const bearing = (i / 64) * 2 * Math.PI;
    const pointLat = Math.asin(
      Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const pointLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat),
      );
    return [(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}
