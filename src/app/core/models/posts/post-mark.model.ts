import { GeoPoint } from '../common/geo.model';

export interface PostMark {
  id: string;
  title: string;
  description?: string;
  coverMediaUrl?: string;
  positiveReactionCount: number;
  coordinates: GeoPoint;
  venueName?: string;
  city?: string;
}
