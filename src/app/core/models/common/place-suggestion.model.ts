import { GeoPoint } from './geo.model';

/** A place from the geocoder in our own terms, cut to the API's limits. Every part but the pin can be missing. */
export interface PlaceSuggestion {
  coordinates: GeoPoint;
  /** From a search, for a place rather than a street or a city. */
  venueName?: string;
  /**
   * From a map click: the name at the pin, for the form to offer but never fill in, because a click can land on a
   * bus shelter.
   */
  offeredName?: string;
  street?: string;
  buildingNum?: string;
  postalCode?: string;
  city?: string;
  /** Two letters, such as `PL`. */
  countryCode?: string;
}

/** The suggestions for what the user typed last. */
export interface PlaceSearch {
  text: string;
  places: PlaceSuggestion[];
  /** The geocoder failed or was too slow. The form says so, and the pin and the city are still enough to save. */
  unavailable: boolean;
}
