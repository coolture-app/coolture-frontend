import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
  of,
  switchMap,
  timeout,
} from 'rxjs';
import { geocoder } from '../../../../environments/geocoder';
import { GeoPoint } from '../../models/common/geo.model';
import { LOCATION_LIMITS } from '../../models/common/location-limits';
import {
  PlaceKind,
  PlaceOption,
  PlaceSearch,
  PlaceSuggestion,
} from '../../models/common/place-suggestion.model';

const MIN_CHARACTERS = 3;
const DEBOUNCE_MS = 400;
const TIMEOUT_MS = 3_000;
const SUGGESTIONS = 5;
/** Stops share venues' names ("Ergo Arena 04") and would push the venue down the list. */
const EXCLUDED = ['osm.highway.bus_stop', 'osm.public_transport', 'osm.amenity.shelter'];
/**
 * Where someone can live. One parameter, an OR: repeating it finds nothing, `layer=city` brings gminas, and
 * neighbourhoods bring hamlets named after cities.
 */
const AREAS = 'osm.place.city,osm.place.town,osm.place.village,osm.place.suburb,osm.place.quarter';
/** As long as `users.home_name` in coolture-aws. */
const PLACE_NAME_MAX = 128;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    /** `house` for venues and addresses alike; `street`, `city`, `district` and so on for areas. */
    type?: string;
    name?: string;
    county?: string;
    state?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    countrycode?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

function cut(text: string | undefined, max: number): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function toPlace(
  { geometry, properties: p }: PhotonFeature,
  from: 'search' | 'pin',
): PlaceSuggestion {
  // GeoJSON puts longitude first.
  const [longitude, latitude] = geometry.coordinates;
  const name = p.type === 'house' ? cut(p.name, LOCATION_LIMITS.venueName) : undefined;
  const place: PlaceSuggestion = {
    coordinates: { latitude, longitude },
    venueName: from === 'search' ? name : undefined,
    offeredName: from === 'pin' ? name : undefined,
    street: cut(p.street ?? (p.type === 'street' ? p.name : undefined), LOCATION_LIMITS.street),
    buildingNum: cut(p.housenumber, LOCATION_LIMITS.buildingNum),
    postalCode: cut(p.postcode, LOCATION_LIMITS.postalCode),
    city: cut(p.city ?? (p.type === 'city' ? p.name : undefined), LOCATION_LIMITS.city),
    countryCode: p.countrycode?.toUpperCase(),
  };
  return Object.fromEntries(
    Object.entries(place).filter(([, value]) => value !== undefined),
  ) as PlaceSuggestion;
}

/**
 * A district is named with its city ("Oliwa, Gdańsk"), since a district's name alone repeats across cities. A city,
 * town or village gets its county as the second line, and anything else its street and city.
 */
function toOption({ geometry, properties: p }: PhotonFeature): PlaceOption | null {
  const [longitude, latitude] = geometry.coordinates;
  const own = p.name ?? [p.street, p.housenumber].filter(Boolean).join(' ');
  if (!own) {
    return null;
  }
  const district = p.type === 'district' && p.city && p.city !== own;
  const name = cut(district ? `${own}, ${p.city}` : own, PLACE_NAME_MAX) ?? own;
  const address = [
    p.name && p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : '',
    p.city,
  ]
    .filter((part) => part && part !== own)
    .join(', ');
  const detail = district ? undefined : p.type === 'city' ? (p.county ?? p.state) : address;
  return { name, coordinates: { latitude, longitude }, ...(detail && { detail }) };
}

/**
 * Photon lists an OSM object once per tag it indexes, so Opera Leśna came as a theatre and as bleachers, and the two
 * rows read the same. Photon's order stays.
 */
function distinct<T>(items: readonly T[], parts: (item: T) => (string | undefined)[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const text = parts(item)
      .map((part) => part ?? '')
      .join('|');
    if (seen.has(text)) {
      return false;
    }
    seen.add(text);
    return true;
  });
}

/**
 * The only code that knows the geocoder, Photon. The form must work without it: every failure, a timeout or a `429`
 * included, ends as `unavailable` or an error, never as a stuck form.
 */
@Injectable({
  providedIn: 'root',
})
export class GeocodingService {
  private http = inject(HttpClient);

  /**
   * Suggestions for a search box's text as it changes. Waits for a pause in typing, and asks only from 3 characters.
   * `near` is read for each request, so it can follow the map's centre.
   */
  search(texts: Observable<string>, near: () => GeoPoint): Observable<PlaceSearch> {
    return this.asTyped(texts, (text) => this.suggest(text, near()));
  }

  /** Like `search`, for places to live in or centre a radius on, named for showing and storing. */
  searchPlaces(
    texts: Observable<string>,
    near: () => GeoPoint,
    kind: PlaceKind,
  ): Observable<PlaceSearch<PlaceOption>> {
    return this.asTyped(texts, (text) => this.findPlaces(text, near(), kind));
  }

  /** One search for `searchPlaces`, with no waiting. Errors like `suggest`. */
  findPlaces(text: string, near: GeoPoint, kind: PlaceKind): Observable<PlaceOption[]> {
    let params = (
      kind === 'area'
        ? new HttpParams().set('lang', 'default').set('include', AREAS)
        : this.params()
    )
      .set('q', text)
      .set('limit', SUGGESTIONS)
      .set('lat', near.latitude)
      .set('lon', near.longitude);
    for (const code of geocoder.countryCodes) {
      params = params.append('countrycode', code);
    }
    return this.get('/api', params).pipe(
      map((features) =>
        distinct(
          features.map(toOption).filter((option): option is PlaceOption => !!option),
          (option) => [option.name, option.detail],
        ),
      ),
    );
  }

  /** The district, or else the city, town or village, at a point. Null where there's none. Errors like `suggest`. */
  areaAt(at: GeoPoint): Observable<PlaceOption | null> {
    const params = new HttpParams()
      .set('lang', 'default')
      .set('include', AREAS)
      .set('lat', at.latitude)
      .set('lon', at.longitude)
      .set('limit', 1);
    return this.get('/reverse', params).pipe(map(([first]) => (first ? toOption(first) : null)));
  }

  private asTyped<Place>(
    texts: Observable<string>,
    ask: (text: string) => Observable<Place[]>,
  ): Observable<PlaceSearch<Place>> {
    return texts.pipe(
      map((text) => text.trim()),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      // Cancels the request for the older text, so a slow answer can't replace a newer one.
      switchMap((text) =>
        text.length < MIN_CHARACTERS
          ? of({ text, places: [], unavailable: false })
          : ask(text).pipe(
              map((places) => ({ text, places, unavailable: false })),
              catchError(() => of({ text, places: [] as Place[], unavailable: true })),
            ),
      ),
    );
  }

  /**
   * One search, with no waiting. Errors when the geocoder fails or takes over 3 seconds. `near` is required: without
   * it a short text matches anywhere in Poland, and "Ergo" gave three offices called Ergo before Ergo Arena.
   */
  suggest(text: string, near: GeoPoint): Observable<PlaceSuggestion[]> {
    let params = this.params()
      .set('q', text)
      .set('limit', SUGGESTIONS)
      .set('lat', near.latitude)
      .set('lon', near.longitude);
    // Search only: /reverse answers 400 to it.
    for (const code of geocoder.countryCodes) {
      params = params.append('countrycode', code);
    }
    return this.get('/api', params).pipe(
      map((features) =>
        distinct(
          features.map((f) => toPlace(f, 'search')),
          (place) => [
            place.venueName,
            place.street,
            place.buildingNum,
            place.postalCode,
            place.city,
          ],
        ),
      ),
    );
  }

  /** The address at a point on the map. Null when there's none, as in the sea. Errors like `suggest`. */
  reverse(at: GeoPoint): Observable<PlaceSuggestion | null> {
    const params = this.params().set('lat', at.latitude).set('lon', at.longitude).set('limit', 1);
    return this.get('/reverse', params).pipe(
      map(([first]) => (first ? toPlace(first, 'pin') : null)),
    );
  }

  /**
   * `lang=default` gives the local names whatever the browser's language. Without it an English browser stores
   * "Gdansk" and "Poland", which everyone then sees.
   */
  private params(): HttpParams {
    let params = new HttpParams().set('lang', 'default');
    for (const category of EXCLUDED) {
      params = params.append('exclude', category);
    }
    return params;
  }

  private get(path: string, params: HttpParams): Observable<PhotonFeature[]> {
    return this.http.get<PhotonResponse>(`${geocoder.url}${path}`, { params }).pipe(
      timeout(TIMEOUT_MS),
      map((response) => response.features ?? []),
    );
  }
}
