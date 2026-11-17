import {
  cardWhen,
  eventEnd,
  EventTimes,
  hasEnded,
  isMultiDay,
  isRunning,
  pageWhen,
  WhenWords,
} from './event-time';

const WORDS: WhenWords = {
  today: 'dziś',
  tomorrow: 'jutro',
  from: 'od',
  fromToday: 'od dziś',
  fromTomorrow: 'od jutra',
  untilFurtherNotice: 'do odwołania',
  runsUntil: 'trwa do',
  runsUntilFurtherNotice: 'trwa do odwołania',
};
/** Wednesday 18 November 2026, 12:00 local time. */
const NOW = new Date(2026, 10, 18, 12, 0);

function post(start: Date, end?: Date, openEnded = false): EventTimes {
  return { startsAt: start.toISOString(), endsAt: end?.toISOString(), openEnded };
}
const card = (p: EventTimes) => cardWhen(p, NOW, 'pl', WORDS);
const page = (p: EventTimes) => pageWhen(p, NOW, 'pl', WORDS);

describe('event time rules', () => {
  it('ends at its end, 3 hours after its start without one, or never with no end date', () => {
    const start = new Date(2026, 10, 18, 19, 0);

    expect(eventEnd(post(start, new Date(2026, 10, 18, 23, 0)))).toEqual(
      new Date(2026, 10, 18, 23, 0),
    );
    expect(eventEnd(post(start))).toEqual(new Date(2026, 10, 18, 22, 0));
    expect(eventEnd(post(start, undefined, true))).toBeNull();
  });

  it('runs from its start to its end', () => {
    expect(isRunning(post(new Date(2026, 10, 18, 10, 0)), NOW)).toBeTrue();
    expect(isRunning(post(new Date(2026, 10, 18, 8, 0)), NOW)).toBeFalse();
    expect(hasEnded(post(new Date(2026, 10, 18, 8, 0)), NOW)).toBeTrue();
    expect(isRunning(post(new Date(2020, 0, 1), undefined, true), NOW)).toBeTrue();
    expect(hasEnded(post(new Date(2020, 0, 1), undefined, true), NOW)).toBeFalse();
  });

  it('counts a night ending before 6:00 as one evening', () => {
    expect(
      isMultiDay(post(new Date(2026, 10, 20, 22, 0), new Date(2026, 10, 21, 4, 0))),
    ).toBeFalse();
    expect(
      isMultiDay(post(new Date(2026, 10, 20, 22, 0), new Date(2026, 10, 21, 7, 0))),
    ).toBeTrue();
  });
});

describe('cardWhen', () => {
  it('says one evening by how far it is', () => {
    expect(card(post(new Date(2026, 10, 18, 19, 0)))).toBe('dziś 19:00');
    expect(card(post(new Date(2026, 10, 19, 19, 0)))).toBe('jutro 19:00');
    expect(card(post(new Date(2026, 10, 20, 19, 0)))).toBe('pt 20 lis, 19:00');
    expect(card(post(new Date(2026, 11, 19, 19, 0)))).toBe('19 gru, 19:00');
    expect(card(post(new Date(2027, 0, 14, 19, 0)))).toBe('14 sty 2027, 19:00');
  });

  it('keeps a night to 4:00 as one evening', () => {
    expect(card(post(new Date(2026, 10, 20, 22, 0), new Date(2026, 10, 21, 4, 0)))).toBe(
      'pt 20 lis, 22:00',
    );
  });

  it('gives a range for several days, with the year after the end in another year', () => {
    expect(card(post(new Date(2026, 10, 20, 19, 0), new Date(2026, 10, 22, 22, 0)))).toBe(
      'pt 20 – niedz 22 lis',
    );
    expect(card(post(new Date(2026, 10, 30, 10, 0), new Date(2026, 11, 3, 18, 0)))).toBe(
      '30 lis – 3 gru',
    );
    expect(card(post(new Date(2026, 11, 30, 10, 0), new Date(2027, 0, 3, 18, 0)))).toBe(
      '30 gru – 3 sty 2027',
    );
  });

  it('says until when a running event is on, the hour when it ends today', () => {
    expect(card(post(new Date(2026, 10, 10, 10, 0), new Date(2026, 10, 22, 22, 0)))).toBe(
      'trwa do niedz 22 lis',
    );
    expect(card(post(new Date(2026, 10, 18, 10, 0), new Date(2026, 10, 18, 22, 0)))).toBe(
      'trwa do 22:00',
    );
    expect(card(post(new Date(2026, 10, 18, 10, 0)))).toBe('trwa do 13:00');
  });

  it('says a post with no end date runs until further notice', () => {
    expect(card(post(new Date(2026, 10, 20, 10, 0), undefined, true))).toBe(
      'od pt 20 lis, do odwołania',
    );
    expect(card(post(new Date(2026, 10, 18, 18, 0), undefined, true))).toBe(
      'od dziś, do odwołania',
    );
    expect(card(post(new Date(2026, 10, 19, 10, 0), undefined, true))).toBe(
      'od jutra, do odwołania',
    );
    expect(card(post(new Date(2025, 0, 1), undefined, true))).toBe('trwa do odwołania');
  });

  it('says an ended event as it would before', () => {
    expect(card(post(new Date(2026, 10, 10, 19, 0)))).toBe('10 lis, 19:00');
    expect(card(post(new Date(2026, 10, 10, 19, 0), new Date(2026, 10, 12, 22, 0)))).toBe(
      'wt 10 – czw 12 lis',
    );
  });

  it('uses the app language', () => {
    expect(cardWhen(post(new Date(2026, 11, 19, 19, 0)), NOW, 'en', WORDS)).toBe('Dec 19, 19:00');
  });
});

describe('pageWhen', () => {
  it('gives the weekday and the hours of one evening', () => {
    expect(page(post(new Date(2026, 10, 19, 19, 0)))).toBe('czw 19 lis, 19:00');
    expect(page(post(new Date(2026, 10, 19, 19, 0), new Date(2026, 10, 19, 22, 0)))).toBe(
      'czw 19 lis, 19:00–22:00',
    );
    expect(page(post(new Date(2027, 0, 14, 19, 0)))).toBe('czw 14 sty 2027, 19:00');
  });

  it('gives both ends of several days', () => {
    expect(page(post(new Date(2026, 10, 20, 19, 0), new Date(2026, 10, 22, 22, 0)))).toBe(
      'pt 20 lis, 19:00 – niedz 22 lis, 22:00',
    );
  });

  it('says until when a running event is on', () => {
    expect(page(post(new Date(2026, 10, 10, 10, 0), new Date(2026, 10, 22, 22, 0)))).toBe(
      'trwa do niedz 22 lis, 22:00',
    );
  });

  it('says a post with no end date runs until further notice', () => {
    expect(page(post(new Date(2026, 10, 20, 19, 0), undefined, true))).toBe(
      'od pt 20 lis, 19:00, do odwołania',
    );
    expect(page(post(new Date(2025, 0, 1), undefined, true))).toBe('trwa do odwołania');
  });
});
