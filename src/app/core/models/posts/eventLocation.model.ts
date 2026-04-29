export interface EventCoordinates {
  latitude: number;
  longitude: number;
}

export interface EventLocation {
  countryCode: string;
  venueName: string | null;
  buildingNum: string | null;
  street: string | null;
  postalCode: string;
  city: string;
  coordinates: EventCoordinates;
}
