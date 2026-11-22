/**
 * When an event ends and how to say when it is, in the browser's time zone. The rules match the API's `EventTime`:
 * the end is `endsAt`, or the start plus `DEFAULT_EVENT_HOURS` without one, or never for a post with no end date (`openEnded`).
 */
export const DEFAULT_EVENT_HOURS = 3;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Up to this many days ahead a date names the weekday, as the map's pins do. */
const WEEKDAY_DAYS = 6;
/** A night out ending before 6:00 belongs to the evening it started, so 22:00-04:00 is one evening. */
const NIGHT_HOURS = 6;

export interface EventTimes {
  startsAt: string;
  endsAt?: string;
  openEnded?: boolean;
}

/** The words around dates, from `EVENT_TIME` in the translations. */
export interface WhenWords {
  today: string;
  tomorrow: string;
  /** "od" before a date. */
  from: string;
  /** "od dziś" and "od jutra". */
  fromToday: string;
  fromTomorrow: string;
  /** "do odwołania". */
  untilFurtherNotice: string;
  /** "trwa do" before an end. */
  runsUntil: string;
  /** "trwa do odwołania". */
  runsUntilFurtherNotice: string;
}

/** Null when the event never ends. */
export function eventEnd(post: EventTimes): Date | null {
  if (post.openEnded) {
    return null;
  }
  return post.endsAt
    ? new Date(post.endsAt)
    : new Date(new Date(post.startsAt).getTime() + DEFAULT_EVENT_HOURS * HOUR_MS);
}

export function hasEnded(post: EventTimes, now: Date): boolean {
  const end = eventEnd(post);
  return end !== null && end < now;
}

export function isRunning(post: EventTimes, now: Date): boolean {
  return new Date(post.startsAt) <= now && !hasEnded(post, now);
}

/** Whether the event's end, moved back `NIGHT_HOURS`, falls on a later day than its start. */
export function isMultiDay(post: EventTimes): boolean {
  const end = eventEnd(post);
  return end !== null && startOfDay(nightDay(end)) > startOfDay(new Date(post.startsAt));
}

/** For cards and the map's preview: "dziś 19:00", "pt 14 – nd 16 lis", "trwa do odwołania". */
export function cardWhen(post: EventTimes, now: Date, locale: string, words: WhenWords): string {
  const start = new Date(post.startsAt);
  const end = eventEnd(post);
  if (end === null) {
    return isRunning(post, now)
      ? words.runsUntilFurtherNotice
      : `${fromDay(start, now, locale, words)}, ${words.untilFurtherNotice}`;
  }
  if (isRunning(post, now)) {
    const lastDay = nightDay(end);
    // After midnight a night's last day is yesterday, and it still ends at an hour.
    return daysBetween(now, lastDay) <= 0
      ? `${words.runsUntil} ${hour(end, locale)}`
      : `${words.runsUntil} ${weekday(lastDay, locale)} ${dayMonth(lastDay, now, locale)}`;
  }
  if (isMultiDay(post)) {
    return range(start, nightDay(end), now, locale);
  }
  return evening(start, now, locale, words);
}

/** For the post's page, with hours: "śr 19 lis, 19:00–22:00", "trwa do nd 16 lis, 22:00". */
export function pageWhen(post: EventTimes, now: Date, locale: string, words: WhenWords): string {
  const start = new Date(post.startsAt);
  const end = eventEnd(post);
  if (end === null) {
    return isRunning(post, now)
      ? words.runsUntilFurtherNotice
      : `${words.from} ${fullDay(start, now, locale)}, ${hour(start, locale)}, ${words.untilFurtherNotice}`;
  }
  if (isRunning(post, now)) {
    return `${words.runsUntil} ${fullDay(end, now, locale)}, ${hour(end, locale)}`;
  }
  const starts = `${fullDay(start, now, locale)}, ${hour(start, locale)}`;
  if (isMultiDay(post)) {
    return `${starts} – ${fullDay(end, now, locale)}, ${hour(end, locale)}`;
  }
  return post.endsAt ? `${starts}–${hour(end, locale)}` : starts;
}

/** One evening on a card: "dziś 19:00", "jutro 19:00", "śr 19 lis, 19:00", "19 gru, 19:00", "14 sty 2027, 19:00". */
function evening(start: Date, now: Date, locale: string, words: WhenWords): string {
  const days = daysBetween(now, start);
  if (days === 0) {
    return `${words.today} ${hour(start, locale)}`;
  }
  if (days === 1) {
    return `${words.tomorrow} ${hour(start, locale)}`;
  }
  const date = dayMonth(start, now, locale);
  const withWeekday = days > 1 && days <= WEEKDAY_DAYS && start.getFullYear() === now.getFullYear();
  return `${withWeekday ? `${weekday(start, locale)} ${date}` : date}, ${hour(start, locale)}`;
}

/** "pt 14 – nd 16 lis" within a month, "30 lis – 3 sty" across months, the year after the end when it isn't this year. */
function range(start: Date, lastDay: Date, now: Date, locale: string): string {
  const year = lastDay.getFullYear() !== now.getFullYear() ? ` ${lastDay.getFullYear()}` : '';
  if (start.getMonth() === lastDay.getMonth() && start.getFullYear() === lastDay.getFullYear()) {
    return `${weekday(start, locale)} ${start.getDate()} – ${weekday(lastDay, locale)} ${plainDayMonth(lastDay, locale)}${year}`;
  }
  return `${plainDayMonth(start, locale)} – ${plainDayMonth(lastDay, locale)}${year}`;
}

/** "od dziś", "od jutra", "od pt 14 lis". */
function fromDay(start: Date, now: Date, locale: string, words: WhenWords): string {
  const days = daysBetween(now, start);
  if (days === 0) {
    return words.fromToday;
  }
  if (days === 1) {
    return words.fromTomorrow;
  }
  return `${words.from} ${weekday(start, locale)} ${dayMonth(start, now, locale)}`;
}

/** "śr 19 lis", with the year when it isn't this year. */
function fullDay(date: Date, now: Date, locale: string): string {
  return `${weekday(date, locale)} ${dayMonth(date, now, locale)}`;
}

/** "19 lis", or "14 sty 2027" in another year. */
function dayMonth(date: Date, now: Date, locale: string): string {
  if (date.getFullYear() === now.getFullYear()) {
    return plainDayMonth(date, locale);
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(date)
    .replace('.', '');
}

/** "19 lis", whatever the year. */
export function plainDayMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    .format(date)
    .replace('.', '');
}

function weekday(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace('.', '');
}

export function hour(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** The calendar day an end belongs to: a night's early hours count to the day before. */
function nightDay(end: Date): Date {
  return new Date(end.getTime() - NIGHT_HOURS * HOUR_MS);
}

export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from a to b, in local time. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}
