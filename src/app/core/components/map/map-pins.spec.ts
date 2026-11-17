import { PostMark } from '../../models/posts/post-mark.model';
import { groupPlaces, pinFeatures, pinLabel, pluralForm, shortTitle } from './map-pins';

const WORDS = {
  today: 'dziś',
  tomorrow: 'jutro',
  now: 'trwa',
  from: 'od',
  todayFrom: 'dziś',
  tomorrowFrom: 'jutra',
};
/** Wednesday 18 November 2026, 12:00 local time. */
const NOW = new Date(2026, 10, 18, 12, 0);

function mark(
  id: string,
  startsAt: Date,
  latitude = 54.35,
  longitude = 18.6,
  more: Partial<PostMark> = {},
) {
  return {
    id,
    title: id,
    startsAt: startsAt.toISOString(),
    positiveReactionCount: 0,
    coordinates: { latitude, longitude },
    ...more,
  } as PostMark;
}

describe('groupPlaces', () => {
  it('puts posts at one point, or a few metres apart, on one pin, soonest first', () => {
    const later = mark('later', new Date(2026, 10, 25), 54.5165, 18.5455);
    const sooner = mark('sooner', new Date(2026, 10, 20), 54.5165, 18.5455);
    // About 15 m north.
    const nextDoor = mark('nextDoor', new Date(2026, 10, 22), 54.51663, 18.5455);

    const places = groupPlaces([later, sooner, nextDoor]);

    expect(places.length).toBe(1);
    expect(places[0].id).toBe('sooner');
    expect(places[0].posts.map((p) => p.id)).toEqual(['sooner', 'nextDoor', 'later']);
  });

  it('keeps places a street apart on pins of their own', () => {
    // About 60 m apart.
    const places = groupPlaces([mark('a', NOW, 54.35, 18.6), mark('b', NOW, 54.35054, 18.6)]);

    expect(places.length).toBe(2);
  });
});

describe('pinLabel', () => {
  const label = (start: Date, end?: Date, openEnded = false) =>
    pinLabel(
      { startsAt: start.toISOString(), endsAt: end?.toISOString(), openEnded },
      NOW,
      'pl',
      WORDS,
    );

  it('gives the hour today and tomorrow', () => {
    expect(label(new Date(2026, 10, 18, 19, 0))).toBe('dziś 19:00');
    expect(label(new Date(2026, 10, 19, 9, 30))).toBe('jutro 09:30');
  });

  it('gives the weekday and day within the week, then the day and month', () => {
    expect(label(new Date(2026, 10, 21, 20, 0))).toBe('sob 21');
    expect(label(new Date(2026, 11, 22, 20, 0))).toBe('22 gru');
  });

  it('says an event that is on is on', () => {
    expect(label(new Date(2026, 10, 10), new Date(2026, 10, 30))).toBe('trwa');
  });

  it('counts an event with no end as on for its first 3 hours', () => {
    expect(label(new Date(2026, 10, 18, 10, 0))).toBe('trwa');
    expect(label(new Date(2026, 10, 18, 8, 59))).toBe('dziś 08:59');
  });

  it('says a post with no end date is on once it started, and gives its start before', () => {
    expect(label(new Date(2025, 0, 1), undefined, true)).toBe('trwa');
    expect(label(new Date(2026, 10, 19, 10, 0), undefined, true)).toBe('jutro 10:00');
  });
});

describe('pluralForm', () => {
  it('follows Polish forms', () => {
    expect([1, 2, 4, 5, 12, 22, 25].map((n) => pluralForm(n, 'pl'))).toEqual([
      'one',
      'few',
      'few',
      'many',
      'many',
      'few',
      'many',
    ]);
    expect(pluralForm(3, 'en')).toBe('many');
  });
});

describe('shortTitle', () => {
  it('cuts a long title on a word', () => {
    expect(shortTitle('Koncert noworoczny Filharmonii')).toBe('Koncert noworoczny…');
    expect(shortTitle('Chicago')).toBe('Chicago');
  });
});

describe('pinFeatures', () => {
  const places = groupPlaces([
    mark('pick', new Date(2026, 10, 28), 54.35, 18.6),
    mark('other', new Date(2026, 10, 19, 18), 54.4, 18.6),
    mark('second', new Date(2026, 10, 29), 54.35, 18.6, { venueName: 'Teatr Muzyczny' }),
  ]);

  it('marks the places with a pick on Dla Ciebie and draws them above the rest', () => {
    const features = pinFeatures(places, new Set(['pick']), NOW, 'pl', WORDS).features;
    const byId = Object.fromEntries(features.map((f) => [f.properties.id, f.properties]));

    expect(byId['pick'].tone).toBe('pick');
    expect(byId['other'].tone).toBe('quiet');
    expect(byId['pick'].sortKey).toBeGreaterThan(byId['other'].sortKey);
  });

  it('gives a place its count and soonest date', () => {
    const [place] = pinFeatures(places, null, NOW, 'pl', WORDS).features.filter(
      (f) => f.properties.count > 1,
    );

    expect(place.properties.label).toBe('2 · od 28 lis');
    expect(place.properties.title).toBe('Teatr Muzyczny');
    expect(place.properties.tone).toBe('plain');
  });

  it('draws the sooner of two plain pins on top', () => {
    const features = pinFeatures(places, null, NOW, 'pl', WORDS).features;
    const key = (id: string) => features.find((f) => f.properties.id === id)!.properties.sortKey;

    expect(key('other')).toBeGreaterThan(key('pick'));
  });
});
