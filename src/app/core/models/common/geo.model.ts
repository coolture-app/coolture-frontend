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

// As read from the API: fields without a value are left out of the JSON.
export interface EventLocation {
  id: string;
  countryCode?: string;
  venueName?: string;
  buildingNum?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  coordinates: GeoPoint;
  createdAt?: string;
}
