export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** A point with a name to show for it: where someone lives, or what a radius is centred on. */
export interface NamedPlace {
  /** "Oliwa, Gdańsk", "Banino", "Ergo Arena". */
  name: string;
  coordinates: GeoPoint;
}

/** What the post form sends. Only the city and the pin are required. */
export interface EventLocationRequest {
  /** Two letters, such as `PL`. */
  countryCode: string | null;
  venueName: string | null;
  buildingNum: string | null;
  street: string | null;
  postalCode: string | null;
  city: string;
  coordinates: GeoPoint;
}

// As read from the API: fields without a value are left out of the JSON.
export interface EventLocation {
  countryCode?: string;
  venueName?: string;
  buildingNum?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  coordinates: GeoPoint;
}
