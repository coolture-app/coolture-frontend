import { GeoPoint } from '../common/geo.model';

export interface PostMark {
  id: string;
  title: string;
  desc: string;
  coverMediaUrl: string | null;
  positiveReactionCount: number;
  coordinates: GeoPoint;
}
