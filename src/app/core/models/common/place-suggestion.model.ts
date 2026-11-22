import { GeoPoint, NamedPlace } from './geo.model';

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

/** A place to live in or centre a radius on, as the place searches offer it. */
export interface PlaceOption extends NamedPlace {
  /** A second line that tells places with the same name apart: the county, or the street and city. */
  detail?: string;
}

/**
 * What a place search looks for: `area` is where someone can live (a city, town, village or district), `any` is
 * anything with a name, venues and streets included.
 */
export type PlaceKind = 'area' | 'any';

/** The suggestions for what the user typed last. */
export interface PlaceSearch<Place = PlaceSuggestion> {
  text: string;
  places: Place[];
  /** The geocoder failed or was too slow. Callers show a note and carry on without suggestions. */
  unavailable: boolean;
}
