import { Params } from '@angular/router';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostsSort } from '../../core/models/common/enums';
import { FilterValues, HomeTab, NO_FILTERS, RADII_KM, START_SORT } from './home-view';

/** What the home page's URL holds, so that a reload or a shared link shows the same list. */
export interface HomeUrlState {
  search: string;
  filters: FilterValues;
  tab: HomeTab;
  sort: PostsSort;
  /** The rounded point the list depends on: the radius's centre, or Najbliższe's. */
  point: GeoPoint | null;
}

const SORTS: readonly PostsSort[] = ['UPCOMING', 'NEAREST', 'POPULAR', 'RECENT'];
const TYPES: readonly string[] = ['OFFLINE', 'ONLINE'];
const VISIBILITIES: readonly string[] = ['PUBLIC', 'PRIVATE', 'FRIENDS'];
/** What a `datetime-local` input holds. Anything else would throw when it's turned into a date. */
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** The query string for a state. Defaults are left out, so the default feed is a plain `/`. */
export function toHomeParams({ search, filters, tab, sort, point }: HomeUrlState): Params {
  const query = search.trim();
  const inAll = tab === 'all';
  const params: Params = {
    ...(inAll && { tab: 'all' }),
    ...(inAll && sort !== START_SORT && { sort: sort.toLowerCase() }),
    ...(query && { q: query }),
    ...(filters.type && { type: filters.type.toLowerCase() }),
    ...(filters.tags.trim() && { tags: filters.tags.trim() }),
    ...(filters.startsFrom && { from: filters.startsFrom }),
    ...(filters.startsTo && { to: filters.startsTo }),
    ...(filters.visibility && { visibility: filters.visibility.toLowerCase() }),
    ...(filters.includePast && { past: 'true' }),
    ...(filters.place && point && { radius: String(filters.radiusKm) }),
    ...(point && { lat: String(point.latitude), lng: String(point.longitude) }),
  };
  return params;
}

/** A state from a query string, which anyone can edit, so an unknown value counts as no value. */
export function fromHomeParams(params: Params): HomeUrlState {
  const text = (name: string): string => (typeof params[name] === 'string' ? params[name] : '');
  const oneOf = (name: string, allowed: readonly string[]): string => {
    const value = text(name).toUpperCase();
    return allowed.includes(value) ? value : '';
  };
  const localTime = (name: string): string => (LOCAL_TIME.test(text(name)) ? text(name) : '');

  const point = readPoint(text('lat'), text('lng'));
  const radius = Number(text('radius'));
  const hasRadius = RADII_KM.includes(radius);
  const tab: HomeTab = text('tab') === 'all' ? 'all' : 'forYou';
  const sort = oneOf('sort', SORTS) as PostsSort | '';

  return {
    search: text('q'),
    tab,
    sort: tab === 'all' && sort ? sort : START_SORT,
    point,
    filters: {
      ...NO_FILTERS,
      type: oneOf('type', TYPES),
      tags: text('tags'),
      startsFrom: localTime('from'),
      startsTo: localTime('to'),
      visibility: oneOf('visibility', VISIBILITIES),
      includePast: text('past') === 'true',
      // A radius with no point asks for the reader's own position.
      place: hasRadius ? (point ? 'picked' : 'mine') : '',
      radiusKm: hasRadius ? radius : NO_FILTERS.radiusKm,
    },
  };
}

/** Whether two query strings say the same, whatever their order. */
export function sameHomeParams(a: Params, b: Params): boolean {
  const sorted = (params: Params) => JSON.stringify(Object.entries(params).sort());
  return sorted(a) === sorted(b);
}

function readPoint(lat: string, lng: string): GeoPoint | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const valid =
    lat !== '' &&
    lng !== '' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  return valid ? { latitude, longitude } : null;
}
