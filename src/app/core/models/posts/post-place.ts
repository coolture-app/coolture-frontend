import { PostBase } from './post-base.model';

/**
 * Where an event is held, with whatever the address has. Every part can be missing.
 * Cards show the venue and city. The post page adds the street and number.
 * Empty for an online event, or one with no address, so the caller decides what to show instead.
 */
export function postPlace(post: Pick<PostBase, 'type' | 'location'>, withAddress = false): string {
  const location = post.location;
  if (post.type === 'ONLINE' || !location) {
    return '';
  }
  const address =
    location.street && [location.street, location.buildingNum].filter(Boolean).join(' ');
  return [location.venueName, withAddress && address, location.city].filter(Boolean).join(', ');
}
