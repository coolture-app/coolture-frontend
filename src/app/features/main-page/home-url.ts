import { Params } from '@angular/router';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostsSort } from '../../core/models/common/enums';
import { KIDS_KIND } from '../../core/services/interests/kinds.service';
import { FilterValues, HomeTab, NO_FILTERS, RADII_KM, START_SORT } from './home-view';

/** What the home page's URL holds, so that a reload or a shared link shows the same list. */
export interface HomeUrlState {
  search: string;
  filters: FilterValues;
  tab: HomeTab;
  sort: PostsSort;
  /** The rounded point the list depends on: the radius's centre, or Najbliższe's. */
  point: GeoPoint | null;
  /** Mapa rather than Lista. */
  map: boolean;
}

const SORTS: readonly PostsSort[] = ['UPCOMING', 'NEAREST', 'POPULAR', 'RECENT'];
/** The contract's pattern for `kinds`. */
const KIND_KEY = /^[a-z_]{1,64}$/;
const MAX_KINDS = 32;
/**
 * A date input's day, with the time older links held after it ("2026-12-01T18:00"), which is dropped. Anything else
 * would throw when it's turned into a date.
 */
const DAY = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(:\d{2})?)?$/;

/** Wszystkie filtered by one kind: Dla dzieci is the switch, any other kind is a chip. */
export function kindParams(key: string): Params {
  return key === KIDS_KIND ? { tab: 'all', kids: 'true' } : { tab: 'all', kinds: key };
}

/** The query string for a state. Defaults are left out, so the default feed is a plain `/`. */
export function toHomeParams({ search, filters, tab, sort, point, map }: HomeUrlState): Params {
  const query = search.trim();
  const inAll = tab === 'all';
  const online = filters.place === 'online';
  const params: Params = {
    ...(inAll && { tab: 'all' }),
    ...(inAll && sort !== START_SORT && { sort: sort.toLowerCase() }),
    ...(query && { q: query }),
    ...(filters.kinds.length && { kinds: filters.kinds.join(',') }),
    ...(filters.kids && { kids: 'true' }),
    // The API's name for it, which older links also used.
    ...(online && { type: 'online' }),
    ...(filters.fromDay && { from: filters.fromDay }),
    ...(filters.toDay && { to: filters.toDay }),
    ...(filters.followed && { followed: 'true' }),
    ...(filters.includePast && { past: 'true' }),
    ...(filters.place && !online && point && { radius: String(filters.radiusKm) }),
    ...(point && { lat: String(point.latitude), lng: String(point.longitude) }),
    ...(map && { view: 'map' }),
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
  const day = (name: string): string => DAY.exec(text(name))?.[1] ?? '';

  const point = readPoint(text('lat'), text('lng'));
  const radius = Number(text('radius'));
  // The chips, or a radius from the map's area: whole km up to the largest chip.
  const hasRadius =
    Number.isInteger(radius) && radius >= 1 && radius <= RADII_KM[RADII_KM.length - 1];
  const tab: HomeTab = text('tab') === 'all' ? 'all' : 'forYou';
  const sort = oneOf('sort', SORTS) as PostsSort | '';
  // Dla dzieci is the switch, so a link that lists it as a kind reads the same.
  const kinds = kindKeys(text('kinds'));
  // Online posts have no place, so no radius, Najbliższe or map goes with them. An old link's type=offline is
  // Wszędzie, as Online is the only type left to choose.
  const online = text('type').toUpperCase() === 'ONLINE';
  const place = online ? 'online' : hasRadius ? (point ? 'picked' : 'mine') : '';

  return {
    search: text('q'),
    tab,
    sort: tab === 'all' && sort && !(online && sort === 'NEAREST') ? sort : START_SORT,
    point: online ? null : point,
    map: text('view') === 'map' && !online,
    filters: {
      ...NO_FILTERS,
      kinds: kinds.filter((key) => key !== KIDS_KIND),
      kids: text('kids') === 'true' || kinds.includes(KIDS_KIND),
      fromDay: day('from'),
      toDay: day('to'),
      followed: text('followed') === 'true',
      includePast: text('past') === 'true',
      // A radius with no point asks for the reader's own position.
      place,
      radiusKm: hasRadius && !online ? radius : NO_FILTERS.radiusKm,
    },
  };
}

/** Whether two query strings say the same, whatever their order. */
export function sameHomeParams(a: Params, b: Params): boolean {
  const sorted = (params: Params) => JSON.stringify(Object.entries(params).sort());
  return sorted(a) === sorted(b);
}

/**
 * Kind keys as the API takes them, without repeats. A well-formed key no post has just matches nothing, so the
 * catalogue isn't needed here; anything else would be a 400.
 */
function kindKeys(value: string): string[] {
  const keys = value.split(',').filter((key) => KIND_KEY.test(key));
  return [...new Set(keys)].slice(0, MAX_KINDS);
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
