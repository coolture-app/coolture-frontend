import { computed, Signal, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { GeoPoint, NamedPlace, TRICITY } from '../../core/models/common/geo.model';
import { PlaceFilter } from './home-view';

/**
 * What the home page measures from: the user's position, a picked place, or their home. The radius, Najbliższe and
 * the place search all start from these.
 */
export class HomePlace {
  /** The user's position, for "Moja lokalizacja" and Najbliższe, once the browser gave it. */
  readonly position = signal<GeoPoint | null>(null);
  /**
   * A place that isn't the user's position, for "Wskazane miejsce": searched for, the home, the map's area or a
   * link's point. Its name is empty until a lookup names a point that came without one.
   */
  readonly picked = signal<NamedPlace | null>(null);
  /** A point the user chose or gave: the radius's centre if one is on, so Najbliższe and the radius agree. */
  readonly own = computed<GeoPoint | null>(
    () => this.radiusCentre() ?? this.position() ?? this.picked()?.coordinates ?? null,
  );
  /** Where Najbliższe measures from: a point the user chose or gave, else their home. */
  readonly sortPoint = computed<GeoPoint | null>(
    () => this.own() ?? this.home()?.coordinates ?? null,
  );
  /** Where suggestions in the place search come from first. */
  readonly searchNear = computed<GeoPoint>(() => this.sortPoint() ?? TRICITY);

  constructor(
    readonly home: Signal<NamedPlace | null>,
    /** The applied radius's centre, if one is on. */
    private readonly radiusCentre: Signal<GeoPoint | null>,
    private readonly areaAt: (point: GeoPoint) => Observable<NamedPlace | null>,
  ) {}

  /** The centre a radius would have for the panel's choice. */
  centre(place: PlaceFilter): GeoPoint | null {
    if (place === 'picked') {
      return this.picked()?.coordinates ?? null;
    }
    return place === 'mine' ? this.position() : null;
  }

  /** A place from the search, or the home. */
  pick({ name, coordinates }: NamedPlace): void {
    this.picked.set({ name, coordinates });
  }

  /**
   * A point from the map or a link. It has no name, so the pill would say only "Wskazane miejsce": the district or
   * city around it names it, if the geocoder answers before the place changes.
   */
  pickPoint(point: GeoPoint | null): void {
    const place = point && { name: '', coordinates: point };
    this.picked.set(place);
    if (place) {
      void this.name(place);
    }
  }

  private async name(place: NamedPlace): Promise<void> {
    try {
      const area = await firstValueFrom(this.areaAt(place.coordinates));
      if (area && this.picked() === place) {
        this.picked.set({ ...place, name: area.name });
      }
    } catch {
      // The pill keeps saying "Wskazane miejsce".
    }
  }
}
