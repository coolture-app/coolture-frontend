import { Feature, FeatureCollection, Point } from 'geojson';
import { GeoPoint } from '../../models/common/geo.model';
import { PostMark } from '../../models/posts/post-mark.model';
import { placeLine } from '../../models/posts/post-place';
import { haversineMeters } from '../../services/location/location.service';
import { daysBetween, hour, isRunning, plainDayMonth } from '../../utils/event-time';

/**
 * Posts this close share one pin. Two venues in one building (Helios and Peron 5 in Metropolia) are a few metres
 * apart, and two pins that close can't be told apart even at full zoom.
 */
export const SAME_PLACE_METERS = 30;
const TITLE_CHARS = 18;
/** Up to this many days ahead a pin names the weekday; further, the month, so "sob 22" is never a month off. */
const WEEKDAY_DAYS = 6;

/** One pin: the posts at one place, soonest first. */
export interface Place {
  /** The soonest post's id, so a place keeps its id while that post is in it. */
  id: string;
  coordinates: GeoPoint;
  posts: PostMark[];
}

/**
 * How a pin stands out. On Dla Ciebie the feed's top picks are `pick`, with a star, and the rest `quiet`, drawn like
 * `plain` but below the picks.
 */
export type PinTone = 'pick' | 'quiet' | 'plain';

export interface PinWords {
  today: string;
  tomorrow: string;
  /** For an event running now. */
  now: string;
  /** Before a place's soonest date: "8 · od sob 22". */
  from: string;
  /** "dziś" and "jutro" after `from`: "od jutra 20:00". */
  todayFrom: string;
  tomorrowFrom: string;
}

export interface PinProperties {
  id: string;
  label: string;
  title: string;
  count: number;
  tone: PinTone;
  sortKey: number;
}

/** The Polish plural forms (1 wydarzenie, 2 wydarzenia, 5 wydarzeń); other languages use `one` and `many`. */
export function pluralForm(count: number, locale: string): 'one' | 'few' | 'many' {
  if (count === 1) {
    return 'one';
  }
  const tens = count % 100;
  const few = count % 10 >= 2 && count % 10 <= 4 && (tens < 12 || tens > 14);
  return locale.startsWith('pl') && few ? 'few' : 'many';
}

/** Groups posts into places. A post joins the first place within `SAME_PLACE_METERS` of its first post. */
export function groupPlaces(marks: readonly PostMark[]): Place[] {
  const places: Place[] = [];
  for (const mark of [...marks].sort(bySoonest)) {
    const place = places.find(
      (p) =>
        // About 30 m of latitude, so most places are skipped without the trigonometry.
        Math.abs(p.coordinates.latitude - mark.coordinates.latitude) < 0.0003 &&
        haversineMeters(p.coordinates, mark.coordinates) <= SAME_PLACE_METERS,
    );
    if (place) {
      place.posts.push(mark);
    } else {
      places.push({ id: mark.id, coordinates: mark.coordinates, posts: [mark] });
    }
  }
  return places;
}

/** The pill's text: the hour today and tomorrow, the weekday and day within the week, else the day and month. */
export function pinLabel(
  post: Pick<PostMark, 'startsAt' | 'endsAt' | 'openEnded'>,
  now: Date,
  locale: string,
  words: PinWords,
): string {
  const start = new Date(post.startsAt);
  if (isRunning(post, now)) {
    return words.now;
  }
  const days = daysBetween(now, start);
  if (days === 0) {
    return `${words.today} ${hour(start, locale)}`;
  }
  if (days === 1) {
    return `${words.tomorrow} ${hour(start, locale)}`;
  }
  if (days > 1 && days <= WEEKDAY_DAYS) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(start);
    return `${weekday.replace('.', '')} ${start.getDate()}`;
  }
  return plainDayMonth(start, locale);
}

/** The title beside the pill when zoomed in, cut on a word where it can be. */
export function shortTitle(title: string): string {
  const text = title.trim().replace(/\s+/g, ' ');
  if (text.length <= TITLE_CHARS) {
    return text;
  }
  const cut = text.slice(0, TITLE_CHARS);
  const space = cut.lastIndexOf(' ');
  return `${(space > TITLE_CHARS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The pin's date: a post's, or "od jutra 20:00" style for a place's soonest. */
function placeDate(place: Place, now: Date, locale: string, words: PinWords): string {
  return pinLabel(
    place.posts[0],
    now,
    locale,
    place.posts.length > 1
      ? { ...words, today: words.todayFrom, tomorrow: words.tomorrowFrom }
      : words,
  );
}

/**
 * What hovering a pin says: a name, then details. A post: its title, then when and where. A place: its name, then
 * how many events and from when.
 */
export function hoverText(
  place: Place,
  now: Date,
  locale: string,
  words: PinWords,
  events: (count: number) => string,
): { name: string; details: string } {
  const [first] = place.posts;
  const count = place.posts.length;
  const where = placeLine(first);
  const when = placeDate(place, now, locale, words);
  if (count === 1) {
    return { name: first.title, details: where ? `${when} · ${where}` : when };
  }
  return { name: where || first.title, details: `${events(count)} · ${words.from} ${when}` };
}

/** The pins as map features. Picks and then the soonest are drawn on top. `picks` is null where nothing is picked. */
export function pinFeatures(
  places: readonly Place[],
  picks: ReadonlySet<string> | null,
  now: Date,
  locale: string,
  words: PinWords,
): FeatureCollection<Point, PinProperties> {
  const features = places.map((place): Feature<Point, PinProperties> => {
    const [first] = place.posts;
    const count = place.posts.length;
    const date = placeDate(place, now, locale, words);
    const tone: PinTone = !picks
      ? 'plain'
      : place.posts.some((post) => picks.has(post.id))
        ? 'pick'
        : 'quiet';
    const minutesAway = Math.max(0, (new Date(first.startsAt).getTime() - now.getTime()) / 60000);
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [place.coordinates.longitude, place.coordinates.latitude],
      },
      properties: {
        id: place.id,
        label: count > 1 ? `${count} · ${words.from} ${date}` : date,
        title: shortTitle(
          (count > 1 && place.posts.find((post) => post.venueName)?.venueName) || first.title,
        ),
        count,
        tone,
        sortKey: (tone === 'pick' ? 1e9 : 0) + Math.max(0, 1e8 - minutesAway),
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

function bySoonest(a: PostMark, b: PostMark): number {
  return a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id);
}
