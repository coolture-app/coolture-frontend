import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

import { locationForm, LocationForm, PlacePicker } from './place-picker';
import { WITHOUT_MAPLIBRE } from '../map/map-stubs.testing';
import { GeocodingService } from '../../services/geocoding/geocoding.service';
import { LocationService } from '../../services/location/location.service';
import { GeoPoint } from '../../models/common/geo.model';
import { PlaceSearch, PlaceSuggestion } from '../../models/common/place-suggestion.model';

const ERGO_ARENA: PlaceSuggestion = {
  coordinates: { latitude: 54.4265, longitude: 18.5805 },
  venueName: 'Ergo Arena',
  street: 'Plac Dwóch Miast',
  buildingNum: '1',
  postalCode: '80-344',
  city: 'Gdańsk',
  countryCode: 'PL',
};

const NEXT_DOOR: PlaceSuggestion = {
  coordinates: { latitude: 54.427, longitude: 18.581 },
  offeredName: 'Hala Olivia',
  street: 'Aleja Grunwaldzka',
  buildingNum: '470',
  postalCode: '80-309',
  city: 'Gdańsk',
  countryCode: 'PL',
};

class FakeGeocoding {
  readonly answers = new Subject<PlaceSearch>();
  readonly asked: string[] = [];
  near: (() => GeoPoint) | null = null;
  reverseAnswer: Observable<PlaceSuggestion | null> = of(null);
  readonly reverse = jasmine.createSpy('reverse').and.callFake(() => this.reverseAnswer);

  search(texts: Observable<string>, near: () => GeoPoint): Observable<PlaceSearch> {
    this.near = near;
    texts.subscribe((text) => this.asked.push(text));
    return this.answers;
  }
}

function click(at: GeoPoint): MapMouseEvent {
  return { lngLat: { lat: at.latitude, lng: at.longitude } } as MapMouseEvent;
}

function fakeMap(): MapLibreMap {
  return { getContainer: () => document.createElement('div') } as unknown as MapLibreMap;
}

describe('PlacePicker', () => {
  let fixture: ComponentFixture<PlacePicker>;
  let picker: PlacePicker;
  let group: LocationForm;
  let geocoding: FakeGeocoding;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** As a person typing: the control's change reaches the form, unlike the picker's own writes. */
  function type(field: 'venueName' | 'street' | 'city', value: string): void {
    group.controls[field].setValue(value);
  }

  beforeEach(async () => {
    geocoding = new FakeGeocoding();
    await TestBed.configureTestingModule({
      imports: [PlacePicker],
      providers: [
        { provide: GeocodingService, useValue: geocoding },
        { provide: LocationService, useValue: { currentIfAllowed: () => Promise.resolve(null) } },
      ],
    })
      .overrideComponent(PlacePicker, WITHOUT_MAPLIBRE)
      .compileComponents();
    fixture = TestBed.createComponent(PlacePicker);
    picker = fixture.componentInstance;
    group = locationForm();
    fixture.componentRef.setInput('group', group);
    await render();
  });

  it('starts with only the search and a way to the map', () => {
    expect(fixture.nativeElement.querySelector('#place-search')).not.toBeNull();
    expect(text()).toContain('PLACE_PICKER.point-on-map');
    expect(fixture.nativeElement.querySelector('mgl-map')).toBeNull();
  });

  it('searches near Trójmiasto before the map can say', () => {
    expect(geocoding.near!()).toEqual({ latitude: 54.44, longitude: 18.57 });
  });

  it('shows suggestions for the text in the box only, with the attribution', async () => {
    picker.onType('ergo');
    geocoding.answers.next({ text: 'erg', places: [NEXT_DOOR], unavailable: false });
    await render();

    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(0);

    geocoding.answers.next({ text: 'ergo', places: [ERGO_ARENA], unavailable: false });
    await render();

    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(1);
    expect(text()).toContain('OpenStreetMap contributors');
  });

  it('a pick fills the place, shows its summary and the map, and asks nothing more', async () => {
    picker.pick(ERGO_ARENA);
    await render();

    expect(group.getRawValue()).toEqual({
      venueName: 'Ergo Arena',
      street: 'Plac Dwóch Miast',
      buildingNum: '1',
      postalCode: '80-344',
      city: 'Gdańsk',
      countryCode: 'PL',
      coordinates: ERGO_ARENA.coordinates,
    });
    expect(group.valid).toBeTrue();
    expect(text()).toContain('Ergo Arena');
    expect(text()).toContain('Plac Dwóch Miast 1, 80-344 Gdańsk');
    expect(fixture.nativeElement.querySelector('mgl-map')).not.toBeNull();
    expect(geocoding.reverse).not.toHaveBeenCalled();
  });

  it('a pick empties the search, so the same text asks again', () => {
    picker.onType('ergo');

    picker.pick(ERGO_ARENA);

    expect(geocoding.asked).toEqual(['ergo', '']);
  });

  it('moving the pin never overwrites typed text, and offers the map’s address', async () => {
    picker.pick(ERGO_ARENA);
    type('street', 'Moja ulica');
    type('venueName', 'Hala');
    geocoding.reverseAnswer = of(NEXT_DOOR);

    picker.onMapClick(click(NEXT_DOOR.coordinates));
    await render();

    expect(group.controls.street.value).toBe('Moja ulica');
    expect(group.controls.venueName.value).toBe('Hala');
    expect(group.controls.buildingNum.value).toBe('470');
    expect(group.controls.coordinates.value).toEqual(NEXT_DOOR.coordinates);
    expect(text()).toContain('PLACE_PICKER.use-address');
    expect(text()).toContain('PLACE_PICKER.use-name');
  });

  it('taking the offered address fills it in', async () => {
    picker.pick(ERGO_ARENA);
    type('street', 'Moja ulica');
    geocoding.reverseAnswer = of(NEXT_DOOR);
    picker.onMapClick(click(NEXT_DOOR.coordinates));

    picker.take('address');
    await render();

    expect(group.controls.street.value).toBe('Aleja Grunwaldzka');
    expect(text()).not.toContain('PLACE_PICKER.use-address');
  });

  it('a lookup that answers after a pick leaves the picked place alone', async () => {
    const slow = new Subject<PlaceSuggestion | null>();
    geocoding.reverseAnswer = slow;
    picker.mapRequested.set(true);
    picker.onMapClick(click(NEXT_DOOR.coordinates));

    picker.pick(ERGO_ARENA);
    slow.next(NEXT_DOOR);
    await render();

    expect(group.controls.street.value).toBe('Plac Dwóch Miast');
    expect(group.controls.coordinates.value).toEqual(ERGO_ARENA.coordinates);
    expect(text()).not.toContain('PLACE_PICKER.looking-up');
    expect(text()).not.toContain('PLACE_PICKER.use-address');
  });

  it('opening a saved post keeps its place as it is', async () => {
    group.patchValue({
      venueName: 'Klub',
      city: 'Sopot',
      countryCode: 'PL',
      coordinates: { latitude: 54.44, longitude: 18.56 },
    });
    await render();

    expect(text()).toContain('Klub');
    expect(geocoding.reverse).not.toHaveBeenCalled();

    geocoding.reverseAnswer = of(NEXT_DOOR);
    picker.onMapClick(click(NEXT_DOOR.coordinates));

    expect(group.controls.venueName.value).toBe('Klub');
    expect(group.controls.city.value).toBe('Sopot');
    expect(group.controls.street.value).toBe('Aleja Grunwaldzka');
  });

  describe('with the geocoder down', () => {
    beforeEach(() => {
      geocoding.reverseAnswer = throwError(() => new Error('timeout'));
    });

    it('says so when the search fails', async () => {
      picker.onType('ergo');
      geocoding.answers.next({ text: 'ergo', places: [], unavailable: true });
      await render();

      expect(text()).toContain('PLACE_PICKER.search-unavailable');
    });

    it('a pin and a typed city are enough', async () => {
      picker.mapRequested.set(true);
      picker.onMapClick(click({ latitude: 54.4, longitude: 18.6 }));
      await render();

      expect(text()).toContain('PLACE_PICKER.lookup-failed');
      expect(fixture.nativeElement.querySelector('#place-city')).not.toBeNull();
      expect(group.valid).toBeFalse();

      type('city', 'Gdańsk');

      expect(group.valid).toBeTrue();
      expect(group.controls.coordinates.value).toEqual({ latitude: 54.4, longitude: 18.6 });
    });
  });

  it('shows coordinate fields only when the map itself fails', async () => {
    picker.mapRequested.set(true);
    await render();
    expect(fixture.nativeElement.querySelector('#place-latitude')).toBeNull();

    picker.onMapError();
    await render();

    expect(fixture.nativeElement.querySelector('#place-latitude')).not.toBeNull();

    picker.latitude.setValue(54.4);
    picker.longitude.setValue(18.6);
    picker.onCoordinatesTyped();

    expect(group.controls.coordinates.value).toEqual({ latitude: 54.4, longitude: 18.6 });
  });

  it('a map that fails after a clear still offers coordinate fields', async () => {
    picker.pick(ERGO_ARENA);
    await render();
    picker.onMapLoad(fakeMap());
    picker.clear();

    picker.mapRequested.set(true);
    await render();
    picker.onMapError();
    await render();

    expect(fixture.nativeElement.querySelector('#place-latitude')).not.toBeNull();
  });

  it('clearing the place empties it and goes back to the search', async () => {
    picker.pick(ERGO_ARENA);

    picker.clear();
    await render();

    expect(group.controls.coordinates.value).toBeNull();
    expect(group.controls.city.value).toBe('');
    expect(fixture.nativeElement.querySelector('mgl-map')).toBeNull();
  });
});
