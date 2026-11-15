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
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, takeUntil, debounceTime, switchMap, tap, catchError, of } from 'rxjs';
import { PostService } from '../../../services/post/post.service';
import { PostFilterParams } from '../../../models/posts/post-filter-params.model';
import { PostMark } from '../../../models/posts/post-mark.model';
import { MapBounds } from '../../../models/posts/map-bounds.model';
import {
  MapComponent as MglMapComponent,
  MarkerComponent,
  PopupComponent,
  GeoJSONSourceComponent,
  MarkersForClustersComponent,
  PointDirective,
  ClusterPointDirective,
  LayerComponent,
} from '@maplibre/ngx-maplibre-gl';
import { FeatureCollection, Point, Feature, Polygon } from 'geojson';
import { MapMarker } from '../map-marker/map-marker';
import { MapPopup } from '../map-popup/map-popup';
import { collapseCredit, MAP_STYLE, TRICITY } from '../map-style';
import { placeLine } from '../../../models/posts/post-place';
import { GeoPoint } from '../../../models/common/geo.model';
import { haversineMeters, LocationService } from '../../../services/location/location.service';

/** Gdynia to Gdańsk in view, so the first look at an unknown user's map shows the whole release area. */
const TRICITY_ZOOM = 10;
const HOME_ZOOM = 12;
const POSITION_ZOOM = 13;
const POSITION_WAIT_MS = 1500;

/** What "Szukaj w tym obszarze" hands over: the circle inside the view, touching its nearer edges. */
export interface MapArea {
  centre: GeoPoint;
  /** Whole km, at least 1. */
  radiusKm: number;
}

@Component({
  selector: 'app-map',
  imports: [
    MglMapComponent,
    MarkerComponent,
    PopupComponent,
    GeoJSONSourceComponent,
    MarkersForClustersComponent,
    PointDirective,
    ClusterPointDirective,
    LayerComponent,
    MapMarker,
    MapPopup,
    TranslatePipe,
  ],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Map implements OnDestroy {
  private postService = inject(PostService);
  private location = inject(LocationService);

  readonly mapStyle = MAP_STYLE;

  filters = input<PostFilterParams>({});
  /** The feed's tab: leave out what the feed leaves out, so the map shows the same posts as the list. */
  excludeMine = input(false);
  /** Where the user lives, where the map starts when the browser gives no position. */
  home = input<GeoPoint | null>(null);
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
  /** The area this map handed over itself. It's already in view, so the map doesn't fit to it. */
  private handedOver: MapArea | null = null;

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
  private map: maplibregl.Map | null = null;

  postsGeoJson = signal<FeatureCollection<Point>>({ type: 'FeatureCollection', features: [] });
  selectedFeature = signal<Feature<Point> | null>(null);

  private destroy$ = new Subject<void>();
  private boundsChange$ = new Subject<maplibregl.LngLatBounds>();
  private marksWanted$ = new Subject<maplibregl.LngLatBounds>();

  constructor() {
    effect(() => {
      // Explicitly read filters to ensure they are tracked by the effect
      this.filters();
      this.excludeMine();
      const area = this.radiusArea();
      // Re-fetch when filters change, if we have bounds. A new radius brings its whole area into view first.
      const map = this.map;
      untracked(() => this.moved.set(false));
      if (area && this.isHandedOver()) {
        this.fittedArea = area;
      }
      if (map && area && this.fittedArea !== area) {
        this.fitTo(map, area);
      } else if (map) {
        this.fetchMarks(map.getBounds());
      }
    });

    this.boundsChange$.pipe(debounceTime(100), takeUntil(this.destroy$)).subscribe((bounds) => {
      this.fetchMarks(bounds);
    });

    // A newer view or filter cancels the request still running, so an older answer never replaces newer pins.
    // The pins on screen stay until the answer arrives; a failed one keeps them.
    this.marksWanted$
      .pipe(
        switchMap((bounds) =>
          this.postService
            .getMapMarks(this.filters(), toMapBounds(bounds), this.excludeMine())
            .pipe(catchError(() => of(null))),
        ),
        tap(() => this.searching.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe((marks) => {
        if (marks) {
          this.postsGeoJson.set({ type: 'FeatureCollection', features: marks.map(toFeature) });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMapLoad(map: maplibregl.Map): void {
    this.map = map;
    collapseCredit(map);
    const home = this.home();
    if (home && !this.radiusArea()) {
      map.jumpTo({ center: [home.longitude, home.latitude], zoom: HOME_ZOOM });
    }
    const area = this.radiusArea();
    if (area) {
      this.fitTo(map, area);
    } else {
      this.fetchMarks(map.getBounds());
      void this.startAtPosition(map);
    }
  }

  /** The browser's position beats the home and Trójmiasto, if it's already allowed and the user hasn't moved yet. */
  private async startAtPosition(map: maplibregl.Map): Promise<void> {
    const position = await this.location.currentIfAllowed(POSITION_WAIT_MS);
    if (position && !this.moved() && !this.radiusArea()) {
      map.jumpTo({ center: [position.longitude, position.latitude], zoom: POSITION_ZOOM });
    }
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

  private fittedArea: Feature<Polygon> | null = null;

  /** The move's end fetches the markers for the new view. */
  private fitTo(map: maplibregl.Map, area: Feature<Polygon>): void {
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

  onMoveEnd(event: unknown): void {
    const { target: map, originalEvent } = event as {
      target: maplibregl.Map;
      originalEvent?: Event;
    };
    // Only the user's own gestures carry an original event; fitting the radius or the start doesn't.
    if (originalEvent) {
      this.moved.set(true);
    }
    this.boundsChange$.next(map.getBounds());
  }

  private fetchMarks(bounds: maplibregl.LngLatBounds): void {
    this.marksWanted$.next(bounds);
  }

  onClusterClick(event: Event, feature: Feature<Point>): void {
    event.stopPropagation();
    const clusterId = feature.properties?.['cluster_id'];
    const source = this.map!.getSource('posts') as maplibregl.GeoJSONSource;
    source.getClusterExpansionZoom(clusterId).then((zoom: number) => {
      this.map!.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom,
        duration: 300,
      });
    });
  }

  onPointClick(event: Event, feature: Feature<Point>): void {
    event.stopPropagation();
    // Pan to marker
    this.map!.panTo(feature.geometry.coordinates as [number, number]);
    this.selectedFeature.set(feature);
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

/** The view, kept inside the world's limits. */
function toMapBounds(bounds: maplibregl.LngLatBounds): MapBounds {
  let west = bounds.getWest();
  let east = bounds.getEast();
  if (east - west >= 360) {
    west = -180;
    east = 180;
  } else {
    west = clamp(west, 180);
    east = clamp(east, 180);
  }
  return {
    leftUpper: { latitude: clamp(bounds.getNorth(), 90), longitude: west },
    rightBottom: { latitude: clamp(bounds.getSouth(), 90), longitude: east },
  };
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function toFeature(mark: PostMark): Feature<Point> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [mark.coordinates.longitude, mark.coordinates.latitude],
    },
    properties: {
      id: mark.id,
      title: mark.title,
      description: mark.description,
      coverMediaUrl: mark.coverMediaUrl,
      place: placeLine(mark),
      positiveReactionCount: mark.positiveReactionCount,
    },
  };
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
