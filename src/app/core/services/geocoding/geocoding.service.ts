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
import { PlaceSearch, PlaceSuggestion } from '../../models/common/place-suggestion.model';

const MIN_CHARACTERS = 3;
const DEBOUNCE_MS = 400;
const TIMEOUT_MS = 3_000;
const SUGGESTIONS = 5;
/** Stops share venues' names ("Ergo Arena 04") and would push the venue down the list. */
const EXCLUDED = ['osm.highway.bus_stop', 'osm.public_transport', 'osm.amenity.shelter'];

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    /** `house` for venues and addresses alike; `street`, `city`, `district` and so on for areas. */
    type?: string;
    name?: string;
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
    return texts.pipe(
      map((text) => text.trim()),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      // Cancels the request for the older text, so a slow answer can't replace a newer one.
      switchMap((text) =>
        text.length < MIN_CHARACTERS
          ? of({ text, places: [], unavailable: false })
          : this.suggest(text, near()).pipe(
              map((places) => ({ text, places, unavailable: false })),
              catchError(() => of({ text, places: [], unavailable: true })),
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
      map((features) => features.map((f) => toPlace(f, 'search'))),
    );
  }

  /** The address at a point on the map. Null when there's none, as in the sea. Errors like `suggest`. */
  reverse(lat: number, lon: number): Observable<PlaceSuggestion | null> {
    const params = this.params().set('lat', lat).set('lon', lon).set('limit', 1);
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
