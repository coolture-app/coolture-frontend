import { eventEnded } from './event-time';

describe('eventEnded', () => {
  const now = new Date('2026-11-17T20:00:00Z');

  it('uses the end when there is one', () => {
    expect(
      eventEnded({ startsAt: '2026-11-17T10:00:00Z', endsAt: '2026-11-17T19:59:00Z' }, now),
    ).toBe(true);
    expect(
      eventEnded({ startsAt: '2026-11-17T10:00:00Z', endsAt: '2026-11-17T20:30:00Z' }, now),
    ).toBe(false);
  });

  it('ends an event with no end three hours after its start', () => {
    expect(eventEnded({ startsAt: '2026-11-17T16:59:00Z' }, now)).toBe(true);
    expect(eventEnded({ startsAt: '2026-11-17T17:01:00Z', endsAt: null }, now)).toBe(false);
  });

  it('keeps an event that has not started open', () => {
    expect(eventEnded({ startsAt: '2026-11-18T10:00:00Z' }, now)).toBe(false);
  });
});
