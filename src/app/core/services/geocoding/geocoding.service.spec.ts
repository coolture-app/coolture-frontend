import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { GeocodingService } from './geocoding.service';
import {
  PlaceOption,
  PlaceSearch,
  PlaceSuggestion,
} from '../../models/common/place-suggestion.model';

/** As public Photon answered for `Ergo` on 2026-11-09, trimmed. */
const ERGO_ARENA = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [18.5805248, 54.4265278] },
  properties: {
    osm_key: 'leisure',
    osm_value: 'stadium',
    type: 'house',
    name: 'Ergo Arena',
    street: 'Plac Dwóch Miast',
    district: 'Żabianka-Wejhera-Jelitkowo-Tysiąclecia',
    city: 'Gdańsk',
    postcode: '80-344',
    countrycode: 'PL',
  },
};

const NEAR = { latitude: 54.4, longitude: 18.6 };

function photon(...features: unknown[]) {
  return { type: 'FeatureCollection', features };
}

describe('GeocodingService', () => {
  let service: GeocodingService;
  let http: HttpTestingController;

  function params(request: TestRequest): Record<string, string[]> {
    const sent = request.request.params;
    return Object.fromEntries(sent.keys().map((key) => [key, sent.getAll(key) ?? []]));
  }

  beforeEach(() => {
    service = TestBed.inject(GeocodingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('suggest', () => {
    it('lists a place that Photon gives twice, once per tag, only once', () => {
      const theatre = {
        ...ERGO_ARENA,
        properties: { ...ERGO_ARENA.properties, osm_key: 'amenity', osm_value: 'theatre' },
      };
      let places: PlaceSuggestion[] = [];
      service.suggest('Ergo', NEAR).subscribe((result) => (places = result));

      http.expectOne((r) => r.url === '/geo/api').flush(photon(ERGO_ARENA, theatre));

      expect(places.length).toBe(1);
    });

    it('asks Photon for local names in Poland, without stops, near the given point', () => {
      service.suggest('Ergo', NEAR).subscribe();

      const request = http.expectOne((r) => r.url === '/geo/api');
      expect(params(request)).toEqual({
        lang: ['default'],
        countrycode: ['PL'],
        exclude: ['osm.highway.bus_stop', 'osm.public_transport', 'osm.amenity.shelter'],
        q: ['Ergo'],
        limit: ['5'],
        lat: ['54.4'],
        lon: ['18.6'],
      });
      request.flush(photon());
    });

    it('maps a venue to our fields, latitude from the second coordinate', () => {
      let places: PlaceSuggestion[] = [];
      service.suggest('Ergo', NEAR).subscribe((result) => (places = result));

      http.expectOne((r) => r.url === '/geo/api').flush(photon(ERGO_ARENA));

      expect(places).toEqual([
        {
          coordinates: { latitude: 54.4265278, longitude: 18.5805248 },
          venueName: 'Ergo Arena',
          street: 'Plac Dwóch Miast',
          postalCode: '80-344',
          city: 'Gdańsk',
          countryCode: 'PL',
        },
      ]);
    });

    it('leaves out what Photon leaves out, and never takes a street or city name for a venue', () => {
      let places: PlaceSuggestion[] = [];
      service.suggest('Długa', NEAR).subscribe((result) => (places = result));

      http
        .expectOne((r) => r.url === '/geo/api')
        .flush(
          photon(
            {
              geometry: { coordinates: [18.65, 54.35] },
              properties: { type: 'street', name: 'Długa' },
            },
            {
              geometry: { coordinates: [18.53, 54.52] },
              properties: { type: 'city', name: 'Gdynia' },
            },
            { geometry: { coordinates: [18.0, 54.0] }, properties: {} },
          ),
        );

      expect(places).toEqual([
        { coordinates: { latitude: 54.35, longitude: 18.65 }, street: 'Długa' },
        { coordinates: { latitude: 54.52, longitude: 18.53 }, city: 'Gdynia' },
        { coordinates: { latitude: 54.0, longitude: 18.0 } },
      ]);
    });

    it("cuts text to the API's limits", () => {
      let places: PlaceSuggestion[] = [];
      service.suggest('Teatr', NEAR).subscribe((result) => (places = result));

      http
        .expectOne((r) => r.url === '/geo/api')
        .flush(
          photon({
            geometry: { coordinates: [18.6, 54.3] },
            properties: { type: 'house', name: 'T'.repeat(100), housenumber: '1'.repeat(20) },
          }),
        );

      expect(places[0].venueName?.length).toBe(64);
      expect(places[0].buildingNum?.length).toBe(16);
    });
  });

  describe('reverse', () => {
    it('sends no country filter, which Photon refuses on reverse', () => {
      service.reverse({ latitude: 54.6044, longitude: 18.348 }).subscribe();

      const request = http.expectOne((r) => r.url === '/geo/reverse');
      expect(params(request)).toEqual({
        lang: ['default'],
        exclude: ['osm.highway.bus_stop', 'osm.public_transport', 'osm.amenity.shelter'],
        lat: ['54.6044'],
        lon: ['18.348'],
        limit: ['1'],
      });
      request.flush(photon());
    });

    it('offers the name at the pin but never fills the venue', () => {
      let place: PlaceSuggestion | null = null;
      service
        .reverse({ latitude: 54.6044, longitude: 18.348 })
        .subscribe((result) => (place = result));

      const request = http.expectOne((r) => r.url === '/geo/reverse');
      request.flush(
        photon({
          geometry: { coordinates: [18.348, 54.6044] },
          properties: {
            type: 'house',
            name: 'Reda Gdańska–Kościół 02',
            street: 'Gdańska',
            city: 'Reda',
          },
        }),
      );

      expect(place!).toEqual({
        coordinates: { latitude: 54.6044, longitude: 18.348 },
        offeredName: 'Reda Gdańska–Kościół 02',
        street: 'Gdańska',
        city: 'Reda',
      });
    });

    it('gives null where there is no address, as in the sea', () => {
      let place: PlaceSuggestion | null | undefined;
      service
        .reverse({ latitude: 54.65, longitude: 18.85 })
        .subscribe((result) => (place = result));

      http.expectOne((r) => r.url === '/geo/reverse').flush(photon());

      expect(place).toBeNull();
    });
  });

  describe('search as the user types', () => {
    let texts: Subject<string>;
    let results: PlaceSearch[];

    function type(text: string): void {
      texts.next(text);
      jasmine.clock().tick(400);
    }

    beforeEach(() => {
      jasmine.clock().install().mockDate(new Date('2026-11-09T12:00:00Z'));
      texts = new Subject<string>();
      results = [];
      service.search(texts, () => NEAR).subscribe((result) => results.push(result));
    });

    afterEach(() => jasmine.clock().uninstall());

    it('waits for a pause in typing and asks once', () => {
      texts.next('Erg');
      jasmine.clock().tick(200);
      texts.next('Ergo');
      jasmine.clock().tick(399);
      http.expectNone(() => true);

      jasmine.clock().tick(1);
      http.expectOne((r) => r.params.get('q') === 'Ergo').flush(photon(ERGO_ARENA));

      expect(results.map((r) => [r.text, r.places.length, r.unavailable])).toEqual([
        ['Ergo', 1, false],
      ]);
    });

    it('asks nothing below 3 characters, and clears the list', () => {
      type('Er');

      http.expectNone(() => true);
      expect(results).toEqual([{ text: 'Er', places: [], unavailable: false }]);
    });

    it('drops the answer to older text when newer text was typed', () => {
      type('Ergo');
      const older = http.expectOne((r) => r.params.get('q') === 'Ergo');
      type('Ergo Ar');
      const newer = http.expectOne((r) => r.params.get('q') === 'Ergo Ar');

      expect(older.cancelled).toBeTrue();
      newer.flush(photon(ERGO_ARENA));

      expect(results.map((r) => r.text)).toEqual(['Ergo Ar']);
    });

    it('gives up after 3 seconds and says the geocoder is unavailable', () => {
      type('Ergo');
      const slow = http.expectOne((r) => r.params.get('q') === 'Ergo');

      jasmine.clock().tick(3000);

      expect(slow.cancelled).toBeTrue();
      expect(results).toEqual([{ text: 'Ergo', places: [], unavailable: true }]);
    });

    it('says the geocoder is unavailable on a 429, and keeps working for the next text', () => {
      type('Ergo');
      http
        .expectOne((r) => r.params.get('q') === 'Ergo')
        .flush('Too Many Requests', { status: 429, statusText: 'Too Many Requests' });
      type('Ergo Arena');
      http.expectOne((r) => r.params.get('q') === 'Ergo Arena').flush(photon(ERGO_ARENA));

      expect(results.map((r) => [r.text, r.places.length, r.unavailable])).toEqual([
        ['Ergo', 0, true],
        ['Ergo Arena', 1, false],
      ]);
    });
  });

  describe('places to live in or centre on', () => {
    const AREAS =
      'osm.place.city,osm.place.town,osm.place.village,osm.place.suburb,osm.place.quarter';

    // As our Photon answered on 2026-11-15, trimmed.
    function area(type: string, name: string, extra: Record<string, string> = {}) {
      return { geometry: { coordinates: [18.56, 54.41] }, properties: { type, name, ...extra } };
    }

    it('asks for cities, towns, villages and districts only, in Poland, near the given point', () => {
      service.findPlaces('Oliwa', NEAR, 'area').subscribe();

      const request = http.expectOne((r) => r.url === '/geo/api');
      expect(params(request)).toEqual({
        lang: ['default'],
        include: [AREAS],
        q: ['Oliwa'],
        limit: ['5'],
        lat: ['54.4'],
        lon: ['18.6'],
        countrycode: ['PL'],
      });
      request.flush(photon());
    });

    it('names a district with its city, and tells villages of one name apart by county', () => {
      let places: PlaceOption[] = [];
      service.findPlaces('Nowa', NEAR, 'area').subscribe((result) => (places = result));

      http
        .expectOne((r) => r.url === '/geo/api')
        .flush(
          photon(
            area('district', 'Oliwa', { city: 'Gdańsk' }),
            area('city', 'Nowa Wieś', { county: 'powiat kartuski' }),
            area('city', 'Nowa Wieś', { county: 'powiat bytowski' }),
            area('city', 'Sopot', { state: 'województwo pomorskie' }),
          ),
        );

      expect(places.map((p) => [p.name, p.detail])).toEqual([
        ['Oliwa, Gdańsk', undefined],
        ['Nowa Wieś', 'powiat kartuski'],
        ['Nowa Wieś', 'powiat bytowski'],
        ['Sopot', 'województwo pomorskie'],
      ]);
      expect(places[0].coordinates).toEqual({ latitude: 54.41, longitude: 18.56 });
    });

    it('lists one object Photon gives twice only once', () => {
      let places: PlaceOption[] = [];
      service.findPlaces('Gdy', NEAR, 'area').subscribe((result) => (places = result));

      const gdynia = area('city', 'Gdynia', { county: 'Gdynia' });
      http.expectOne((r) => r.url === '/geo/api').flush(photon(gdynia, gdynia));

      expect(places.length).toBe(1);
    });

    it('finds any place for a radius, without stops, with its address as the second line', () => {
      let places: PlaceOption[] = [];
      service.findPlaces('Ergo', NEAR, 'any').subscribe((result) => (places = result));

      const request = http.expectOne((r) => r.url === '/geo/api');
      expect(params(request)['exclude']).toEqual([
        'osm.highway.bus_stop',
        'osm.public_transport',
        'osm.amenity.shelter',
      ]);
      expect(params(request)['include']).toBeUndefined();
      request.flush(photon(ERGO_ARENA, area('street', 'Grunwaldzka', { city: 'Gdańsk' })));

      expect(places.map((p) => [p.name, p.detail])).toEqual([
        ['Ergo Arena', 'Plac Dwóch Miast, Gdańsk'],
        ['Grunwaldzka', 'Gdańsk'],
      ]);
    });

    it('names the district or village around a point, without a country filter', () => {
      let found: PlaceOption | null = null;
      service.areaAt({ latitude: 54.41, longitude: 18.56 }).subscribe((result) => (found = result));

      const request = http.expectOne((r) => r.url === '/geo/reverse');
      expect(params(request)).toEqual({
        lang: ['default'],
        include: [AREAS],
        lat: ['54.41'],
        lon: ['18.56'],
        limit: ['1'],
      });
      request.flush(photon(area('district', 'Oliwa', { city: 'Gdańsk' })));

      expect(found!.name).toBe('Oliwa, Gdańsk');
    });

    it('gives null where there is no place around a point', () => {
      let found: PlaceOption | null | undefined;
      service.areaAt({ latitude: 55, longitude: 18 }).subscribe((result) => (found = result));

      http.expectOne((r) => r.url === '/geo/reverse').flush(photon());

      expect(found).toBeNull();
    });
  });
});
