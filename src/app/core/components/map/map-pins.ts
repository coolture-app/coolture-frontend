import { Feature, FeatureCollection, Point } from 'geojson';
import { GeoPoint } from '../../models/common/geo.model';
import { PostMark } from '../../models/posts/post-mark.model';
import { haversineMeters } from '../../services/location/location.service';

/**
 * Posts this close share one pin. Two venues in one building (Helios and Peron 5 in Metropolia) are a few metres
 * apart, and two pins that close can't be told apart even at full zoom.
 */
export const SAME_PLACE_METERS = 30;
const TITLE_CHARS = 18;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Up to this many days ahead a pin names the weekday; further, the month, so "sob 22" is never a month off. */
const WEEKDAY_DAYS = 6;

/** One pin: the posts at one place, soonest first. */
export interface Place {
  /** The soonest post's id, so a place keeps its id while that post is in it. */
  id: string;
  coordinates: GeoPoint;
  posts: PostMark[];
}

/** How a pin stands out. On Dla Ciebie the feed's top picks are `pick` and the rest `quiet`; elsewhere `plain`. */
export type PinTone = 'pick' | 'quiet' | 'plain';

export interface PinWords {
  today: string;
  tomorrow: string;
  /** For an event running now. */
  now: string;
  /** Before a place's soonest date: "8 · od sob 22". */
  from: string;
}

export interface PinProperties {
  id: string;
  label: string;
  title: string;
  count: number;
  tone: PinTone;
  sortKey: number;
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
  post: Pick<PostMark, 'startsAt' | 'endsAt'>,
  now: Date,
  locale: string,
  words: PinWords,
): string {
  const start = new Date(post.startsAt);
  if (post.endsAt && start <= now && new Date(post.endsAt) > now) {
    return words.now;
  }
  const days = Math.round((startOfDay(start) - startOfDay(now)) / DAY_MS);
  const hour = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (days === 0) {
    return `${words.today} ${hour.format(start)}`;
  }
  if (days === 1) {
    return `${words.tomorrow} ${hour.format(start)}`;
  }
  if (days > 1 && days <= WEEKDAY_DAYS) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(start);
    return `${weekday.replace('.', '')} ${start.getDate()}`;
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    .format(start)
    .replace('.', '');
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
    const date = pinLabel(first, now, locale, words);
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

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
