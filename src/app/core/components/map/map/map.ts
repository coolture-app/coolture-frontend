import {
  ChangeDetectionStrategy,
  Component,
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
} from '@maplibre/ngx-maplibre-gl';
import { FeatureCollection, Point, Feature } from 'geojson';
import { MapMarker } from '../map-marker/map-marker';
import { MapPopup } from '../map-popup/map-popup';

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
    MapMarker,
    MapPopup,
  ],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Map implements OnDestroy {
  private postService = inject(PostService);

  filters = input<PostFilterParams>({});

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
      // Re-fetch when filters change, if we have bounds
      if (this.mapComponent?.mapInstance) {
        this.fetchMarks(this.mapComponent.mapInstance.getBounds());
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
    this.fetchMarks(map.getBounds());
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

    this.postService.getMapMarks(this.filters(), mapBounds).subscribe((marks: PostMark[]) => {
      const features = marks.map((mark) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [mark.coordinates.longitude, mark.coordinates.latitude],
        },
        properties: {
          id: mark.id,
          title: mark.title,
          desc: mark.desc,
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
