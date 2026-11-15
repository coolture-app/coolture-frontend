import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TranslatePipe } from '@ngx-translate/core';

import { Map, MapArea } from './map';
import { GeoPoint } from '../../../models/common/geo.model';
import { LocationService } from '../../../services/location/location.service';

/** What the component asks of a MapLibre map, around a view from (54.30, 18.50) to (54.40, 18.70). */
function fakeMap() {
  return {
    jumpTo: jasmine.createSpy('jumpTo'),
    fitBounds: jasmine.createSpy('fitBounds'),
    getContainer: () => document.createElement('div'),
    getCenter: () => ({ lat: 54.35123, lng: 18.60456 }),
    getBounds: () => ({
      getNorth: () => 54.4,
      getSouth: () => 54.3,
      getWest: () => 18.5,
      getEast: () => 18.7,
      getNorthEast: () => ({ lat: 54.4, lng: 18.7 }),
    }),
  };
}

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
          useValue: { currentIfAllowed: () => Promise.resolve(allowed) },
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

  it('shows the answer to the newest request only', async () => {
    await load();
    http.match((r) => r.url.endsWith('/posts/map')).forEach((r) => r.flush([]));

    fixture.componentRef.setInput('excludeMine', true);
    await fixture.whenStable();
    const older = http.expectOne((r) => r.params.get('excludeMine') === 'true');
    fixture.componentRef.setInput('excludeMine', false);
    await fixture.whenStable();
    const newer = http.expectOne(
      (r) => r.url.endsWith('/posts/map') && !r.params.has('excludeMine'),
    );

    expect(older.cancelled).toBeTrue();
    newer.flush([mark('newer')]);
    expect(component.postsGeoJson().features.map((f) => f.properties?.['id'])).toEqual(['newer']);
  });

  it('keeps the pins it has when a request fails', async () => {
    await load();
    http.expectOne((r) => r.url.endsWith('/posts/map')).flush([mark('kept')]);

    fixture.componentRef.setInput('excludeMine', true);
    await fixture.whenStable();
    http
      .expectOne((r) => r.url.endsWith('/posts/map'))
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.postsGeoJson().features.map((f) => f.properties?.['id'])).toEqual(['kept']);
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
});

function mark(id: string) {
  return {
    id,
    title: id,
    description: '',
    positiveReactionCount: 0,
    coordinates: { latitude: 54.35, longitude: 18.6 },
    city: 'Gdańsk',
  };
}
