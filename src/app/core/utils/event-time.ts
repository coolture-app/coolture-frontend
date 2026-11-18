/**
 * When an event ends, in the browser's time zone. The rules match the API's `EventTime`: the end is `endsAt`, or the
 * start + 3 hours without one.
 */
export const DEFAULT_EVENT_HOURS = 3;

const HOUR_MS = 60 * 60 * 1000;

export interface EventTimes {
  startsAt: string;
  endsAt?: string;
}

export function eventEnd(post: EventTimes): Date {
  return post.endsAt
    ? new Date(post.endsAt)
    : new Date(new Date(post.startsAt).getTime() + DEFAULT_EVENT_HOURS * HOUR_MS);
}

/** Interesuje mnie and Biorę udział mean nothing once this is true, and the API refuses them. */
export function hasEnded(post: EventTimes, now: Date): boolean {
  return eventEnd(post) < now;
}
