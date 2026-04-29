export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface EventLocationRequest {
  countryCode: string;
  venueName: string | null;
  buildingNum: string | null;
  street: string | null;
  postalCode: string;
  city: string;
  coordinates: GeoPoint;
}

export interface EventLocation extends EventLocationRequest {
  id: string;
  createdAt: string;
}
