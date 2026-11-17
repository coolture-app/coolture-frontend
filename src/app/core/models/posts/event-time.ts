/** An event with no end time has ended this long after it starts. The API's rule, in `common`'s `EventTime`. */
export const DEFAULT_EVENT_HOURS = 3;

interface Timed {
  startsAt: string;
  endsAt?: string | null;
}

export function eventEnd(post: Timed): Date {
  return post.endsAt
    ? new Date(post.endsAt)
    : new Date(new Date(post.startsAt).getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000);
}

/** Interesuje mnie and Biorę udział mean nothing once this is true, and the API refuses them. */
export function eventEnded(post: Timed, now: Date): boolean {
  return eventEnd(post) < now;
}
