import { commentTime } from './comment-time';

describe('commentTime', () => {
  const now = new Date('2026-11-09T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('says now for the first minute', () => {
    expect(commentTime(ago(10_000), 'en', now)).toBe('now');
    expect(commentTime(ago(10_000), 'pl', now)).toBe('teraz');
  });

  it('counts minutes, hours and days, in the given language', () => {
    expect(commentTime(ago(5 * MINUTE), 'en', now)).toContain('5');
    expect(commentTime(ago(5 * MINUTE), 'en', now)).toContain('min');
    expect(commentTime(ago(2 * HOUR), 'pl', now)).toContain('2 godz.');
    expect(commentTime(ago(3 * DAY), 'pl', now)).toContain('3 dni');
  });

  it('gives a date after a week, with the year only when it differs', () => {
    expect(commentTime('2026-10-20T12:00:00Z', 'en', now)).not.toContain('2026');
    expect(commentTime('2025-10-20T12:00:00Z', 'en', now)).toContain('2025');
  });
});
