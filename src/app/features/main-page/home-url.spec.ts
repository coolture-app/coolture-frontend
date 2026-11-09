import { fromHomeParams, HomeUrlState, sameHomeParams, toHomeParams } from './home-url';
import { NO_FILTERS } from './home-view';

const DEFAULT: HomeUrlState = {
  search: '',
  filters: NO_FILTERS,
  tab: 'forYou',
  sort: 'UPCOMING',
  point: null,
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
      filters: {
        ...NO_FILTERS,
        type: 'OFFLINE',
        tags: 'rock,folk',
        startsFrom: '2026-12-01T18:00',
        startsTo: '2026-12-02T23:30',
        visibility: 'PUBLIC',
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
      type: 'offline',
      tags: 'rock,folk',
      from: '2026-12-01T18:00',
      to: '2026-12-02T23:30',
      visibility: 'public',
      past: 'true',
      radius: '25',
      lat: '54.35',
      lng: '18.65',
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

  it('asks for the reader’s own position when a radius comes with no point', () => {
    expect(fromHomeParams({ radius: '10' }).filters.place).toBe('mine');
  });

  it('ignores values someone typed wrongly, instead of failing later', () => {
    const state = fromHomeParams({
      tab: 'nope',
      sort: 'nope',
      type: 'nope',
      visibility: 'nope',
      from: 'tomorrow',
      to: '2026-13',
      past: 'maybe',
      radius: '7',
      lat: '999',
      lng: 'east',
      q: ['two', 'values'],
    });

    expect(state).toEqual(DEFAULT);
  });

  it('needs both coordinates for a point', () => {
    expect(fromHomeParams({ lat: '54.35' }).point).toBeNull();
    expect(fromHomeParams({ lat: '0', lng: '0' }).point).toEqual({ latitude: 0, longitude: 0 });
  });

  it('compares query strings whatever their order', () => {
    expect(sameHomeParams({ a: '1', b: '2' }, { b: '2', a: '1' })).toBeTrue();
    expect(sameHomeParams({ a: '1' }, { a: '2' })).toBeFalse();
    expect(sameHomeParams({ a: '1' }, {})).toBeFalse();
  });
});
