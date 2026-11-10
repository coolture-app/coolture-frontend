import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { PostService } from '../../../services/post/post.service';
import { PostFilterParams } from '../../../models/posts/post-filter-params.model';
import { PostMark } from '../../../models/posts/post-mark.model';
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
import { MAP_STYLE } from '../map-style';

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
  ],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Map implements OnDestroy {
  private postService = inject(PostService);

  readonly mapStyle = MAP_STYLE;

  filters = input<PostFilterParams>({});
  /** The feed's tab: leave out what the feed leaves out, so the map shows the same posts as the list. */
  excludeMine = input(false);

  /** The location filter's area, drawn over the map. */
  readonly radiusArea = computed(() => {
    const { latitude, longitude, radiusKm } = this.filters();
    return latitude !== undefined && longitude !== undefined && radiusKm
      ? circle(latitude, longitude, radiusKm)
      : null;
  });

  @ViewChild('map') mapComponent!: MglMapComponent;

  postsGeoJson = signal<FeatureCollection<Point>>({ type: 'FeatureCollection', features: [] });
  selectedFeature = signal<Feature<Point> | null>(null);
  hiddenClusterIds = signal<Set<number>>(new Set());

  private destroy$ = new Subject<void>();
  private boundsChange$ = new Subject<maplibregl.LngLatBounds>();

  constructor() {
    effect(() => {
      // Explicitly read filters to ensure they are tracked by the effect
      this.filters();
      this.excludeMine();
      const area = this.radiusArea();
      // Re-fetch when filters change, if we have bounds. A new radius brings its whole area into view first.
      const map = this.mapComponent?.mapInstance;
      if (map && area && this.fittedArea !== area) {
        this.fitTo(map, area);
      } else if (map) {
        this.fetchMarks(map.getBounds());
      }
    });

    this.boundsChange$.pipe(debounceTime(100), takeUntil(this.destroy$)).subscribe((bounds) => {
      this.fetchMarks(bounds);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMapLoad(map: maplibregl.Map): void {
    const area = this.radiusArea();
    if (area) {
      this.fitTo(map, area);
    } else {
      this.fetchMarks(map.getBounds());
    }
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
    const map = (event as { target: maplibregl.Map }).target;
    this.boundsChange$.next(map.getBounds());
    this.hiddenClusterIds.set(new Set());
  }

  private fetchMarks(bounds: maplibregl.LngLatBounds): void {
    let north = bounds.getNorth();
    let south = bounds.getSouth();
    let west = bounds.getWest();
    let east = bounds.getEast();

    // Prevent bounds from exceeding global max limits
    if (east - west >= 360) {
      west = -180;
      east = 180;
    } else {
      west = Math.max(-180, Math.min(180, west));
      east = Math.max(-180, Math.min(180, east));
    }

    north = Math.max(-90, Math.min(90, north));
    south = Math.max(-90, Math.min(90, south));

    const mapBounds = {
      leftUpper: { latitude: north, longitude: west },
      rightBottom: { latitude: south, longitude: east },
    };

    this.postService
      .getMapMarks(this.filters(), mapBounds, this.excludeMine())
      .subscribe((marks: PostMark[]) => {
        const features = marks.map((mark) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [mark.coordinates.longitude, mark.coordinates.latitude],
          },
          properties: {
            id: mark.id,
            title: mark.title,
            description: mark.description,
            coverMediaUrl: mark.coverMediaUrl,
            positiveReactionCount: mark.positiveReactionCount,
          },
        }));
        this.postsGeoJson.set({ type: 'FeatureCollection', features });
      });
  }

  onClusterClick(event: Event, feature: Feature<Point>): void {
    event.stopPropagation();
    const clusterId = feature.properties?.['cluster_id'];
    if (clusterId) {
      this.hiddenClusterIds.update((ids) => {
        const next = new Set(ids);
        next.add(clusterId);
        return next;
      });
    }
    const source = this.mapComponent.mapInstance.getSource('posts') as maplibregl.GeoJSONSource;
    source.getClusterExpansionZoom(clusterId).then((zoom: number) => {
      this.mapComponent.mapInstance.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom,
        duration: 300,
      });
    });
  }

  onPointClick(event: Event, feature: Feature<Point>): void {
    event.stopPropagation();
    // Pan to marker
    this.mapComponent.mapInstance.panTo(feature.geometry.coordinates as [number, number]);
    this.selectedFeature.set(feature);
  }
}

const EARTH_RADIUS_KM = 6371;

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
