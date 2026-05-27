import { GeoPoint } from '../common/geo.model';

export interface MapBounds {
  leftUpper: GeoPoint;
  rightBottom: GeoPoint;
}
