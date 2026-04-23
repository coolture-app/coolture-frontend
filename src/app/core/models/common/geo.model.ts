export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface EventLocation {
  id: string | null;
  countryCode: string;
  venueName: string | null;
  buildingNum: string | null;
  street: string | null;
  postalCode: string;
  city: string;
  coordinates: GeoPoint;
}
