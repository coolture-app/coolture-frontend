import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TranslatePipe } from '@ngx-translate/core';

import { Map, MapArea } from './map';
import { GeoPoint } from '../../../models/common/geo.model';
import { LocationService } from '../../../services/location/location.service';
import { MapMemory } from '../map-memory';
import { MapMarks } from '../map-marks';
import { mark } from '../map-stubs.testing';

/** What the component asks of a MapLibre map, around a view from (54.30, 18.50) to (54.40, 18.70). */
function fakeMap() {
  const view = { north: 54.4, south: 54.3, west: 18.5, east: 18.7 };
  return {
    view,
    jumpTo: jasmine.createSpy('jumpTo'),
    easeTo: jasmine.createSpy('easeTo'),
    fitBounds: jasmine.createSpy('fitBounds'),
    resize: jasmine.createSpy('resize'),
    getZoom: () => 12,
    getContainer: () => document.createElement('div'),
    getCanvas: () => ({ style: {}, clientWidth: 400, clientHeight: 600 }),
    setPadding: jasmine.createSpy('setPadding'),
    on: jasmine.createSpy('on'),
    unproject: () => ({ lat: view.north, lng: 18.60456 }),
    // The pills are drawn on a canvas; the specs don't need them.
    hasImage: () => true,
    cameraForBounds: () => ({ zoom: 11 }),
    queryRenderedFeatures: () => [],
    getCenter: () => ({ lat: 54.35123, lng: 18.60456 }),
    getBounds: () => ({
      getNorth: () => view.north,
      getSouth: () => view.south,
      getWest: () => view.west,
      getEast: () => view.east,
    }),
  };
}

const marks = () => (r: { url: string }) => r.url.endsWith('/posts/map');

describe('Map', () => {
  let component: Map;
  let fixture: ComponentFixture<Map>;
  let http: HttpTestingController;
  let allowed: GeoPoint | null;

  beforeEach(async () => {
    allowed = null;
    await TestBed.configureTestingModule({
      imports: [Map],
      providers: [
        {
          provide: LocationService,
          useValue: {
            currentIfAllowed: () => Promise.resolve(allowed),
            request: () => Promise.resolve(null),
            precisePosition: () => null,
          },
        },
      ],
    })
      // MapLibre's tags stay unknown elements, so no WebGL, tiles or MapService.
      .overrideComponent(Map, {
        set: { imports: [TranslatePipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Map);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() =>
    http
      .match(() => true)
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush([])),
  );

  async function load(map = fakeMap()) {
    component.onMapLoad(map as never);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    return map;
  }

  it('starts over Trójmiasto wide enough for Gdynia and Gdańsk', () => {
    expect(component.start).toEqual({ center: [18.57, 54.44], zoom: 10 });
  });

  it('moves to the home when there is one', async () => {
    fixture.componentRef.setInput('home', { latitude: 54.52, longitude: 18.54 });

    const map = await load();

    expect(map.jumpTo).toHaveBeenCalledWith({ center: [18.54, 54.52], zoom: 12 });
  });

  it('opens where it was left on Back from a post, though setting its padding ends a move', async () => {
    TestBed.inject(MapMemory).view = {
      center: [18.6, 54.4],
      zoom: 14.5,
      selected: 'p1',
      opened: null,
    };
    fixture.componentRef.setInput('resume', true);
    const map = fakeMap();
    // MapLibre's setPadding is a jump, and a jump ends with a moveend.
    map.setPadding.and.callFake(() => component.onMoveEnd({}));

    await load(map);

    expect(map.jumpTo).toHaveBeenCalledWith({ center: [18.6, 54.4], zoom: 14.5 });
  });

  it('shows the pins it had on Back from a post, with no request', async () => {
    const store = TestBed.inject(MapMarks);
    store.load(
      { north: 54.4, south: 54.3, west: 18.5, east: 18.7 },
      { filters: {}, excludeMine: false },
    );
    http.expectOne(marks()).flush([mark('p1')]);
    TestBed.inject(MapMemory).view = {
      center: [18.6, 54.35],
      zoom: 12,
      selected: 'p1',
      opened: null,
    };
    fixture.componentRef.setInput('resume', true);

    await load();

    http.expectNone(marks());
    expect(component.selected()?.id).toBe('p1');
  });

  it('starts without the pins of an earlier look when opened afresh', async () => {
    const store = TestBed.inject(MapMarks);
    store.load(
      { north: 54.4, south: 54.3, west: 18.5, east: 18.7 },
      { filters: {}, excludeMine: false },
    );
    http.expectOne(marks()).flush([mark('old')]);

    await load();

    expect(component.places()).toEqual([]);
    http.expectOne(marks()).flush([]);
  });

  it('moves to the browser position over the home, if it is already allowed', async () => {
    fixture.componentRef.setInput('home', { latitude: 54.52, longitude: 18.54 });
    allowed = { latitude: 54.35, longitude: 18.65 };

    const map = await load();

    expect(map.jumpTo).toHaveBeenCalledWith({ center: [18.65, 54.35], zoom: 13 });
  });

  it('offers a search in the view only after the user moves the map', async () => {
    const map = await load();

    component.onMoveEnd({ target: map });
    expect(component.moved()).toBeFalse();

    component.onMoveEnd({ target: map, originalEvent: new MouseEvent('mouseup') });
    await fixture.whenStable();
    expect(component.moved()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.map-search-area')).not.toBeNull();
  });

  it('hands over the circle inside the view, touching its nearer edges', async () => {
    const map = await load();
    const areas: MapArea[] = [];
    component.searchArea.subscribe((area) => areas.push(area));
    component.onMoveEnd({ target: map, originalEvent: new MouseEvent('mouseup') });

    component.onSearchArea();

    // 5.4 km to the north edge, 6.2 km to the east one.
    expect(areas[0]).toEqual({ centre: { latitude: 54.351, longitude: 18.605 }, radiusKm: 5 });
    expect(component.moved()).toBeFalse();
  });

  it('keeps the search button busy until the area it handed over has its pins', async () => {
    const map = await load();
    http.match((r) => r.url.endsWith('/posts/map')).forEach((r) => r.flush([]));
    component.onMoveEnd({ target: map, originalEvent: new MouseEvent('mouseup') });
    component.searchArea.subscribe(({ centre, radiusKm }) =>
      fixture.componentRef.setInput('filters', { ...centre, radiusKm }),
    );

    component.onSearchArea();
    await fixture.whenStable();
    const button = () => fixture.nativeElement.querySelector('.map-search-area');
    expect(button().disabled).toBeTrue();

    http.expectOne((r) => r.params.get('radiusKm') === '5').flush([]);
    await fixture.whenStable();
    expect(component.searching()).toBeFalse();
    expect(button()).toBeNull();
  });

  it('keeps its view for the area it handed over, and fits to any other', async () => {
    const map = await load();
    component.onMoveEnd({ target: map, originalEvent: new MouseEvent('mouseup') });
    component.searchArea.subscribe(({ centre, radiusKm }) =>
      fixture.componentRef.setInput('filters', { ...centre, radiusKm }),
    );

    component.onSearchArea();
    await fixture.whenStable();
    expect(map.fitBounds).not.toHaveBeenCalled();

    fixture.componentRef.setInput('filters', { latitude: 54.5, longitude: 18.5, radiusKm: 10 });
    await fixture.whenStable();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });
  it('waits while Lista hides it, and fetches when shown', async () => {
    fixture.componentRef.setInput('visible', false);
    await fixture.whenStable();
    await load();
    http.expectNone(marks());

    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    http.expectOne(marks()).flush([]);
  });

  it('opens on a focused post and shows it even when the filters leave it out', async () => {
    fixture.componentRef.setInput('focus', mark('focused', 54.36));
    const map = await load();
    http.expectOne(marks()).flush([mark('other')]);

    expect(map.easeTo).toHaveBeenCalledWith(
      jasmine.objectContaining({ center: [18.6, 54.36], zoom: 15, duration: 0 }),
    );
    expect(component.places().map((p) => p.id)).toEqual(['focused', 'other']);
    expect(component.selected()?.id).toBe('focused');
  });

  it('lights up the top picks on Dla Ciebie only', async () => {
    await load();
    http.expectOne(marks()).flush([mark('pick'), mark('other', 54.38)]);
    const tones = () =>
      component.pins().features.map((f) => [f.properties?.['id'], f.properties?.['tone']]);

    expect(tones()).toEqual([
      ['other', 'plain'],
      ['pick', 'plain'],
    ]);
    fixture.componentRef.setInput('picks', new Set(['pick']));
    expect(tones()).toEqual([
      ['other', 'quiet'],
      ['pick', 'pick'],
    ]);
  });
});
