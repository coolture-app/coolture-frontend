import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MapMarks, MarksQuery } from './map-marks';
import { Box } from './map-geometry';
import { mark } from './map-stubs.testing';

const ALL: MarksQuery = { filters: {}, excludeMine: false };
const isMarks = (r: { url: string }) => r.url.endsWith('/posts/map');

describe('MapMarks', () => {
  let store: MapMarks;
  let http: HttpTestingController;
  let view: Box;
  const ids = () =>
    store
      .marks()
      .map((m) => m.id)
      .sort();

  beforeEach(() => {
    store = TestBed.inject(MapMarks);
    http = TestBed.inject(HttpTestingController);
    view = { north: 54.4, south: 54.3, west: 18.5, east: 18.7 };
  });

  it('fetches a box two views wider on each side, and asks again before a pan reaches its edge', () => {
    expect(store.load(view, ALL)).toBeTrue();
    const first = http.expectOne(isMarks);
    expect(Number(first.request.params.get('leftUpper.latitude'))).toBeCloseTo(54.6);
    expect(Number(first.request.params.get('rightBottom.longitude'))).toBeCloseTo(19.1);
    first.flush([mark('kept', 54.42)]);

    expect(store.load({ ...view, west: 18.55, east: 18.75 }, ALL)).toBeFalse();
    http.expectNone(isMarks);

    expect(store.load({ ...view, west: 18.9, east: 19.1 }, ALL)).toBeTrue();
    http.expectOne(isMarks).flush([mark('new', 54.35)]);

    // 18.6 is inside the new box, so the answer is the truth there; 'kept' was at 18.6 too and went.
    expect(ids()).toEqual(['new']);
  });

  it('keeps the pins it loaded outside the box of a new answer', () => {
    store.load(view, ALL);
    http.expectOne(isMarks).flush([mark('far', 54.35)]);

    store.load({ ...view, north: 56.4, south: 56.3 }, ALL);
    http.expectOne(isMarks).flush([mark('north', 56.35)]);

    expect(ids()).toEqual(['far', 'north']);
  });

  it('shows the answer to the newest request only', () => {
    store.load(view, { filters: {}, excludeMine: true });
    const older = http.expectOne((r) => r.params.get('excludeMine') === 'true');
    store.load(view, ALL);
    const newer = http.expectOne((r) => isMarks(r) && !r.params.has('excludeMine'));

    expect(older.cancelled).toBeTrue();
    newer.flush([mark('newer')]);
    expect(ids()).toEqual(['newer']);
  });

  it('keeps the pins it has when a request fails, and asks again next time', () => {
    store.load(view, ALL);
    http.expectOne(isMarks).flush([mark('kept')]);

    store.load(view, { filters: {}, excludeMine: true });
    http.expectOne(isMarks).flush(null, { status: 500, statusText: 'Server Error' });
    expect(ids()).toEqual(['kept']);
    expect(store.loading()).toBeFalse();

    expect(store.load(view, { filters: {}, excludeMine: true })).toBeTrue();
    http.expectOne(isMarks).flush([]);
  });

  it('starts from nothing once forgotten', () => {
    store.load(view, ALL);
    http.expectOne(isMarks).flush([mark('old')]);

    store.forget();

    expect(ids()).toEqual([]);
    expect(store.load(view, ALL)).toBeTrue();
    http.expectOne(isMarks).flush([]);
  });
});
