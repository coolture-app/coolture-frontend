import { EventLocation } from '../common/geo.model';
import { PostBase } from './post-base.model';

type PlaceParts = Pick<EventLocation, 'venueName' | 'street' | 'buildingNum' | 'city'>;

/**
 * Where an event is held, with whatever the address has. Every part can be missing.
 * Cards and map popups show the venue and city. The post page adds the street and number.
 */
export function placeLine(place: PlaceParts, withAddress = false): string {
  const address = place.street && [place.street, place.buildingNum].filter(Boolean).join(' ');
  return [place.venueName, withAddress && address, place.city].filter(Boolean).join(', ');
}

/** Empty for an online event, or one with no address, so the caller decides what to show instead. */
export function postPlace(post: Pick<PostBase, 'type' | 'location'>, withAddress = false): string {
  return post.type === 'ONLINE' || !post.location ? '' : placeLine(post.location, withAddress);
}
