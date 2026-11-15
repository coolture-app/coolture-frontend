import { GeoPoint } from '../common/geo.model';

export interface PostMark {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  coverMediaUrl?: string;
  /** The description's start, for the map's preview. */
  excerpt?: string;
  positiveReactionCount: number;
  /** Left out for a post opened from its card, which has only the two together. */
  interestedCount?: number;
  goingCount?: number;
  coordinates: GeoPoint;
  venueName?: string;
  city?: string;
}
