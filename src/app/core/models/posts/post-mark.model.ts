import { GeoPoint } from '../common/geo.model';

export interface PostMark {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  coverMediaUrl?: string;
  positiveReactionCount: number;
  coordinates: GeoPoint;
  venueName?: string;
  city?: string;
}
