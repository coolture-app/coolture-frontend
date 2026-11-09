const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "przed chwilą" style text for the last week, and a date after that, in the given language. */
export function commentTime(iso: string, lang: string, now = Date.now()): string {
  const time = new Date(iso);
  const age = now - time.getTime();
  const relative = new Intl.RelativeTimeFormat(lang, { style: 'short' });

  if (age < MINUTE) {
    return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(0, 'second');
  }
  if (age < HOUR) {
    return relative.format(-Math.floor(age / MINUTE), 'minute');
  }
  if (age < DAY) {
    return relative.format(-Math.floor(age / HOUR), 'hour');
  }
  if (age < 7 * DAY) {
    return relative.format(-Math.floor(age / DAY), 'day');
  }
  const sameYear = time.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    ...(!sameYear && { year: 'numeric' }),
  }).format(time);
}
