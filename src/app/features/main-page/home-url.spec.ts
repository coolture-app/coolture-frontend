import { fromHomeParams, HomeUrlState, kindParams, sameHomeParams, toHomeParams } from './home-url';
import { dayWindow, NO_FILTERS } from './home-view';

const DEFAULT: HomeUrlState = {
  search: '',
  filters: NO_FILTERS,
  tab: 'forYou',
  sort: 'UPCOMING',
  point: null,
  map: false,
};

describe('the home URL', () => {
  it('is a plain / for the default feed', () => {
    expect(toHomeParams(DEFAULT)).toEqual({});
    expect(fromHomeParams({})).toEqual(DEFAULT);
  });

  it('writes lowercase values, and reads them back', () => {
    const state: HomeUrlState = {
      search: 'jazz',
      tab: 'all',
      sort: 'POPULAR',
      point: { latitude: 54.35, longitude: 18.65 },
      map: true,
      filters: {
        ...NO_FILTERS,
        fromDay: '2026-12-01',
        toDay: '2026-12-02',
        followed: true,
        includePast: true,
        place: 'picked',
        radiusKm: 25,
      },
    };

    const params = toHomeParams(state);

    expect(params).toEqual({
      tab: 'all',
      sort: 'popular',
      q: 'jazz',
      from: '2026-12-01',
      to: '2026-12-02',
      followed: 'true',
      past: 'true',
      radius: '25',
      lat: '54.35',
      lng: '18.65',
      view: 'map',
    });
    expect(fromHomeParams(params)).toEqual(state);
  });

  it('leaves the sort out on Dla Ciebie, which has no menu', () => {
    expect(toHomeParams({ ...DEFAULT, sort: 'POPULAR' })).toEqual({});
    expect(fromHomeParams({ sort: 'popular' }).sort).toBe('UPCOMING');
  });

  it('carries Najbliższe’s point with no radius', () => {
    const params = toHomeParams({
      ...DEFAULT,
      tab: 'all',
      sort: 'NEAREST',
      point: { latitude: 54.35, longitude: 18.65 },
    });

    expect(params).toEqual({ tab: 'all', sort: 'nearest', lat: '54.35', lng: '18.65' });
    expect(fromHomeParams(params).filters.place).toBe('');
  });

  it('writes Online as the API’s type, with no radius or point', () => {
    const params = toHomeParams({
      ...DEFAULT,
      tab: 'all',
      filters: { ...NO_FILTERS, place: 'online', radiusKm: 25 },
    });

    expect(params).toEqual({ tab: 'all', type: 'online' });
    expect(fromHomeParams(params).filters).toEqual({ ...NO_FILTERS, place: 'online' });
  });

  it('reads Online over a radius, a map and Najbliższe, which need a place', () => {
    const state = fromHomeParams({
      tab: 'all',
      sort: 'nearest',
      type: 'ONLINE',
      radius: '10',
      lat: '54.35',
      lng: '18.65',
      view: 'map',
    });

    expect(state.filters.place).toBe('online');
    expect(state.filters.radiusKm).toBe(NO_FILTERS.radiusKm);
    expect(state.point).toBeNull();
    expect(state.map).toBeFalse();
    expect(state.sort).toBe('UPCOMING');
  });

  it('reads an old link’s type=offline as Wszędzie, or as its radius', () => {
    expect(fromHomeParams({ type: 'offline' })).toEqual(DEFAULT);
    expect(fromHomeParams({ type: 'offline', radius: '10' }).filters.place).toBe('mine');
  });

  it('asks for the reader’s own position when a radius comes with no point', () => {
    expect(fromHomeParams({ radius: '10' }).filters.place).toBe('mine');
  });

  it('ignores values someone typed wrongly, instead of failing later', () => {
    const state = fromHomeParams({
      tab: 'nope',
      sort: 'nope',
      type: 'nope',
      followed: 'yes',
      from: 'tomorrow',
      to: '2026-13',
      past: 'maybe',
      radius: '7.5',
      lat: '999',
      lng: 'east',
      q: ['two', 'values'],
    });

    expect(state).toEqual(DEFAULT);
  });

  it('carries the kinds as one list, and Dla dzieci', () => {
    const state: HomeUrlState = {
      ...DEFAULT,
      filters: { ...NO_FILTERS, kinds: ['concerts', 'stage'], kids: true },
    };

    const params = toHomeParams(state);

    expect(params).toEqual({ kinds: 'concerts,stage', kids: 'true' });
    expect(fromHomeParams(params)).toEqual(state);
  });

  it('keeps only well-formed kinds, once each, which the API would refuse otherwise', () => {
    const { filters } = fromHomeParams({ kinds: 'concerts,Stage,,concerts,a-b,food', kids: 'yes' });

    expect(filters.kinds).toEqual(['concerts', 'food']);
    expect(filters.kids).toBeFalse();
  });

  it('reads kinds=kids as the Dla dzieci switch, not as a kind', () => {
    const { filters } = fromHomeParams({ kinds: 'concerts,kids' });

    expect(filters.kinds).toEqual(['concerts']);
    expect(filters.kids).toBeTrue();
  });

  it('links Dla dzieci as the switch, and any other kind as a chip', () => {
    expect(kindParams('kids')).toEqual({ tab: 'all', kids: 'true' });
    expect(kindParams('concerts')).toEqual({ tab: 'all', kinds: 'concerts' });
    expect(fromHomeParams(kindParams('kids')).filters.kids).toBeTrue();
  });

  it('takes a whole radius from the map’s area, up to the largest chip', () => {
    expect(fromHomeParams({ radius: '7', lat: '54.35', lng: '18.65' }).filters.radiusKm).toBe(7);
    expect(fromHomeParams({ radius: '0', lat: '54.35', lng: '18.65' }).filters.place).toBe('');
    expect(fromHomeParams({ radius: '150', lat: '54.35', lng: '18.65' }).filters.place).toBe('');
  });

  it('needs both coordinates for a point', () => {
    expect(fromHomeParams({ lat: '54.35' }).point).toBeNull();
    expect(fromHomeParams({ lat: '0', lng: '0' }).point).toEqual({ latitude: 0, longitude: 0 });
  });

  it('reads an older link’s date and time as its day', () => {
    const { filters } = fromHomeParams({ from: '2026-12-01T18:00', to: '2026-12-02T23:30' });

    expect(filters.fromDay).toBe('2026-12-01');
    expect(filters.toDay).toBe('2026-12-02');
    expect(toHomeParams({ ...DEFAULT, filters })).toEqual({ from: '2026-12-01', to: '2026-12-02' });
  });

  it('compares query strings whatever their order', () => {
    expect(sameHomeParams({ a: '1', b: '2' }, { b: '2', a: '1' })).toBeTrue();
    expect(sameHomeParams({ a: '1' }, { a: '2' })).toBeFalse();
    expect(sameHomeParams({ a: '1' }, {})).toBeFalse();
  });
});

describe('the filter days', () => {
  it('run from the first day’s start to the last day’s end, in local time', () => {
    expect(dayWindow('2026-11-21', '2026-11-22')).toEqual({
      from: new Date(2026, 10, 21, 0, 0, 0, 0).toISOString(),
      to: new Date(2026, 10, 22, 23, 59, 59, 999).toISOString(),
    });
    expect(dayWindow('', '2026-11-22')).toEqual({
      to: new Date(2026, 10, 22, 23, 59, 59, 999).toISOString(),
    });
    expect(dayWindow('', '')).toEqual({});
  });
});
