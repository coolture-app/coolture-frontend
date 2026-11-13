import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MapComponent, MarkerComponent } from '@maplibre/ngx-maplibre-gl';
import type { LngLat, Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import { catchError, map, of, Subject, switchMap } from 'rxjs';

import { FormInput } from '../form-input/form-input';
import { MAP_STYLE, TRICITY } from '../map/map-style';
import { GeocodingService } from '../../services/geocoding/geocoding.service';
import { LocationService } from '../../services/location/location.service';
import { GeoPoint } from '../../models/common/geo.model';
import { LOCATION_LIMITS } from '../../models/common/location-limits';
import { PlaceSearch, PlaceSuggestion } from '../../models/common/place-suggestion.model';
import {
  addressFound,
  describePlace,
  EMPTY_DRAFT,
  offerTaken,
  PLACE_FIELDS,
  picked,
  pinMoved,
  PlaceDraft,
  PlaceOffer,
  savedDraft,
  typed,
} from './place-draft';

const NOT_BLANK = Validators.pattern(/\S/);
const PLACE_ZOOM = 16;
const AREA_ZOOM = 11;
/** How long the start point waits for a position the user already allowed. */
const POSITION_WAIT_MS = 1_500;

/** The place of an in-person post. Only the city and the pin are required. */
export function locationForm() {
  const text = (max: number, required = false) =>
    new FormControl('', {
      nonNullable: true,
      validators: required
        ? [Validators.required, NOT_BLANK, Validators.maxLength(max)]
        : Validators.maxLength(max),
    });
  return new FormGroup({
    venueName: text(LOCATION_LIMITS.venueName),
    street: text(LOCATION_LIMITS.street),
    buildingNum: text(LOCATION_LIMITS.buildingNum),
    postalCode: text(LOCATION_LIMITS.postalCode),
    city: text(LOCATION_LIMITS.city, true),
    countryCode: new FormControl<string | null>(null),
    coordinates: new FormControl<GeoPoint | null>(null, Validators.required),
  });
}

export type LocationForm = ReturnType<typeof locationForm>;

function lngLat(point: GeoPoint): [number, number] {
  return [point.longitude, point.latitude];
}

/** About 10 cm, which is all a pin can mean. */
function rounded(at: LngLat): GeoPoint {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return { latitude: round(at.lat), longitude: round(at.lng) };
}

/**
 * The "Gdzie?" of an in-person post: a search, a map with a pin, and the address fields, three ways to set one place.
 * The rules for who may change a field are in place-draft.ts; this component wires them to the geocoder, the map and
 * the form.
 */
@Component({
  selector: 'app-place-picker',
  imports: [ReactiveFormsModule, TranslatePipe, FormInput, MapComponent, MarkerComponent],
  templateUrl: './place-picker.html',
  styleUrl: './place-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacePicker implements OnInit {
  private geocoding = inject(GeocodingService);
  private location = inject(LocationService);
  private destroyRef = inject(DestroyRef);

  readonly group = input.required<LocationForm>();

  readonly limits = LOCATION_LIMITS;
  readonly describe = describePlace;
  readonly mapStyle = MAP_STYLE;

  readonly draft = signal<PlaceDraft>(EMPTY_DRAFT);
  readonly summary = computed(() => describePlace(this.draft().text));
  readonly hasPlace = computed(() => this.draft().coordinates !== null);
  readonly pin = computed(() => {
    const at = this.draft().coordinates;
    return at ? lngLat(at) : null;
  });
  readonly offeredAddress = computed(() => {
    const address = this.draft().offer?.address;
    if (!address) {
      return null;
    }
    const lines = describePlace(address);
    return [lines.name, lines.address].filter(Boolean).join(', ');
  });

  readonly query = signal('');
  readonly results = signal<PlaceSearch | null>(null);
  readonly listOpen = signal(false);
  readonly active = signal(-1);
  /** Suggestions for the text in the box, never for an older one. */
  readonly suggestions = computed(() => {
    const results = this.results();
    return results && results.text === this.query().trim() ? results.places : [];
  });
  readonly searchUnavailable = computed(() => this.results()?.unavailable ?? false);

  /** Opened by "Wskaż na mapie" before a place is set. */
  readonly mapRequested = signal(false);
  readonly showMap = computed(() => this.hasPlace() || this.mapRequested());
  readonly fieldsOpen = signal(false);
  private readonly lookingUpAt = signal<GeoPoint | null>(null);
  readonly lookingUp = computed(() => {
    const at = this.lookingUpAt();
    return at !== null && at === this.draft().coordinates;
  });
  readonly lookupFailed = signal(false);
  /** The map's style or tiles never loaded, so typed coordinates are the only way to set a pin. */
  readonly tilesFailed = signal(false);
  /** MapLibre needs a browser, so the map waits for the first render there. */
  readonly inBrowser = signal(false);

  readonly latitude = new FormControl<number | null>(null, [
    Validators.min(-90),
    Validators.max(90),
  ]);
  readonly longitude = new FormControl<number | null>(null, [
    Validators.min(-180),
    Validators.max(180),
  ]);

  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');
  private mapInstance: MapLibreMap | null = null;
  private mapLoaded = false;
  /** Where the map opens and what a short search is near, until the map can say. */
  private start: GeoPoint = TRICITY;
  /** The view the map should show when it appears. */
  view: { center: [number, number]; zoom: number } = { center: lngLat(TRICITY), zoom: AREA_ZOOM };

  private readonly texts = new Subject<string>();
  private readonly pins = new Subject<GeoPoint>();

  constructor() {
    afterNextRender(() => {
      this.inBrowser.set(true);
      void this.location.currentIfAllowed(POSITION_WAIT_MS).then((position) => {
        if (position) {
          this.start = position;
          if (!this.hasPlace()) {
            this.view = { center: lngLat(position), zoom: AREA_ZOOM };
          }
        }
      });
    });

    this.geocoding
      .search(this.texts, () => this.near())
      .pipe(takeUntilDestroyed())
      .subscribe((results) => {
        this.results.set(results);
        this.active.set(-1);
      });

    this.pins
      .pipe(
        switchMap((at) =>
          this.geocoding.reverse(at).pipe(
            map((found) => ({ at, found, failed: false })),
            // A failed lookup leaves the fields as they are: the user types the city.
            catchError(() => of({ at, found: null, failed: true })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ at, found, failed }) => {
        // A pick, a clear or a saved post came first, so the answer is about a pin that's gone.
        if (at !== this.draft().coordinates) {
          return;
        }
        this.lookingUpAt.set(null);
        if (failed) {
          this.lookupFailed.set(true);
        } else {
          this.apply(addressFound(this.draft(), found));
        }
        this.openFieldsIfIncomplete();
      });
  }

  ngOnInit(): void {
    this.syncFromForm();
    // Programmatic writes don't emit, so whatever arrives here is the user typing or a saved post loading.
    this.group()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncFromForm());
  }

  private syncFromForm(): void {
    const value = this.group().getRawValue();
    let next = this.draft();
    for (const field of PLACE_FIELDS) {
      if (value[field] !== next.text[field]) {
        next = typed(next, field, value[field]);
      }
    }
    if (value.coordinates !== next.coordinates) {
      // A saved post arrived: its place is the user's own, and the map shows it.
      next = savedDraft(next.text, value.coordinates, value.countryCode);
      if (value.coordinates) {
        this.view = { center: lngLat(value.coordinates), zoom: PLACE_ZOOM };
      }
    }
    this.draft.set(next);
  }

  private apply(next: PlaceDraft): void {
    this.draft.set(next);
    this.group().patchValue(
      { ...next.text, countryCode: next.countryCode, coordinates: next.coordinates },
      { emitEvent: false },
    );
  }

  private near(): GeoPoint {
    const centre = this.mapInstance?.getCenter();
    return centre ? rounded(centre) : this.start;
  }

  // --- Search ---

  onType(text: string): void {
    this.setQuery(text);
    this.listOpen.set(true);
  }

  /** The search skips a text equal to the last one it saw, so it hears every change of the box, emptying included. */
  private setQuery(text: string): void {
    this.query.set(text);
    this.texts.next(text);
  }

  onSearchKey(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (count) {
          event.preventDefault();
          this.listOpen.set(true);
          const step = event.key === 'ArrowDown' ? 1 : -1;
          this.active.set((this.active() + step + count) % count);
        }
        break;
      case 'Enter':
        // The search box never sends the post.
        event.preventDefault();
        if (this.listOpen() && count) {
          this.pick(this.suggestions()[Math.max(this.active(), 0)]);
        }
        break;
      case 'Escape':
        if (this.listOpen()) {
          event.preventDefault();
          this.listOpen.set(false);
        }
        break;
    }
  }

  pick(place: PlaceSuggestion): void {
    this.apply(picked(place));
    this.setQuery('');
    this.listOpen.set(false);
    this.lookupFailed.set(false);
    this.fieldsOpen.set(false);
    this.group().controls.coordinates.markAsTouched();
    this.moveMapTo(place.coordinates, PLACE_ZOOM);
    this.openFieldsIfIncomplete();
  }

  /** The place can be set again from scratch, with the search box ready. */
  clear(): void {
    this.apply(EMPTY_DRAFT);
    this.group().markAsUntouched();
    this.mapRequested.set(false);
    this.fieldsOpen.set(false);
    this.lookupFailed.set(false);
    this.searchBox()?.nativeElement.focus();
  }

  // --- Map ---

  onMapLoad(instance: MapLibreMap): void {
    this.mapInstance = instance;
    this.mapLoaded = true;
    // MapLibre opens the compact credit, which covers a third of a phone-sized map. It stays one tap away.
    instance
      .getContainer()
      .querySelector('.maplibregl-ctrl-attrib')
      ?.classList.remove('maplibregl-compact-show');
  }

  onMapError(): void {
    // A tile that fails later leaves a usable map; only a map that never loaded needs typed coordinates.
    if (!this.mapLoaded) {
      this.tilesFailed.set(true);
      this.openFieldsIfIncomplete(true);
    }
  }

  onMapClick(event: MapMouseEvent): void {
    this.placePin(rounded(event.lngLat));
  }

  onPinDragged(marker: Marker): void {
    this.placePin(rounded(marker.getLngLat()));
  }

  onCoordinatesTyped(): void {
    const latitude = this.latitude.value;
    const longitude = this.longitude.value;
    if (
      latitude === null ||
      longitude === null ||
      this.latitude.invalid ||
      this.longitude.invalid
    ) {
      return;
    }
    this.placePin({ latitude, longitude });
  }

  private placePin(at: GeoPoint): void {
    this.apply(pinMoved(this.draft(), at));
    this.group().controls.coordinates.markAsTouched();
    this.lookingUpAt.set(at);
    this.lookupFailed.set(false);
    this.pins.next(at);
  }

  private moveMapTo(at: GeoPoint, zoom: number): void {
    this.view = { center: lngLat(at), zoom };
    this.mapInstance?.jumpTo({ center: lngLat(at), zoom });
  }

  // --- Fields and offers ---

  take(part: keyof PlaceOffer): void {
    this.apply(offerTaken(this.draft(), part));
  }

  /** Without a city the post can't be saved, so its field shows by itself. */
  private openFieldsIfIncomplete(always = false): void {
    if (always || (this.hasPlace() && !this.draft().text.city.trim())) {
      this.fieldsOpen.set(true);
    }
  }

  /** The post form calls this when saving fails, so a missing city shows. The form then focuses the first error. */
  revealErrors(): void {
    if (this.hasPlace() && this.group().invalid) {
      this.fieldsOpen.set(true);
    }
  }
}
