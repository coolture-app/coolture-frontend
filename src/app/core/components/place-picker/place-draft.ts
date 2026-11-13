import { GeoPoint } from '../../models/common/geo.model';
import { PlaceSuggestion } from '../../models/common/place-suggestion.model';

/** The place's text fields, the ones the user can see and type in. */
export const ADDRESS_FIELDS = ['street', 'buildingNum', 'postalCode', 'city'] as const;
export const PLACE_FIELDS = ['venueName', ...ADDRESS_FIELDS] as const;
export type PlaceField = (typeof PLACE_FIELDS)[number];

export type PlaceText = Record<PlaceField, string>;

/**
 * One place being set, and who wrote each field. A field the geocoder filled is automatic and the next pin move may
 * replace it. A field the user typed is theirs, and only the user changes it.
 */
export interface PlaceDraft {
  text: PlaceText;
  coordinates: GeoPoint | null;
  countryCode: string | null;
  automatic: ReadonlySet<PlaceField>;
  /** What the map has at the pin, offered in one click instead of overwriting the user's text. */
  offer: PlaceOffer | null;
}

export interface PlaceOffer {
  /** The map's address, when it differs from the address the user typed. */
  address?: Pick<PlaceText, (typeof ADDRESS_FIELDS)[number]>;
  /** The name at the pin, when the venue name differs. Never filled in, since a click can land on a bus shelter. */
  name?: string;
}

const EMPTY_TEXT: PlaceText = {
  venueName: '',
  street: '',
  buildingNum: '',
  postalCode: '',
  city: '',
};

export const EMPTY_DRAFT: PlaceDraft = {
  text: EMPTY_TEXT,
  coordinates: null,
  countryCode: null,
  automatic: new Set(),
  offer: null,
};

function textOf(place: PlaceSuggestion): PlaceText {
  return {
    venueName: place.venueName ?? '',
    street: place.street ?? '',
    buildingNum: place.buildingNum ?? '',
    postalCode: place.postalCode ?? '',
    city: place.city ?? '',
  };
}

/** A saved place, as the user's own: opening a post to edit changes nothing until the user does. */
export function savedDraft(
  text: PlaceText,
  coordinates: GeoPoint | null,
  countryCode: string | null,
): PlaceDraft {
  return { text, coordinates, countryCode, automatic: new Set(), offer: null };
}

/** A search suggestion replaces the whole place. */
export function picked(place: PlaceSuggestion): PlaceDraft {
  return {
    text: textOf(place),
    coordinates: place.coordinates,
    countryCode: place.countryCode ?? null,
    automatic: new Set(PLACE_FIELDS),
    offer: null,
  };
}

/** The pin moved, before the address at it is known. */
export function pinMoved(draft: PlaceDraft, to: GeoPoint): PlaceDraft {
  return { ...draft, coordinates: to, offer: null };
}

/**
 * The address at the pin arrived: it fills fields that are empty or automatic, and offers the rest. The venue name is
 * only ever offered. `found` is null where the map has no address, as in the sea, and then automatic fields empty,
 * since they described the old point.
 */
export function addressFound(draft: PlaceDraft, found: PlaceSuggestion | null): PlaceDraft {
  const map = found ? textOf(found) : EMPTY_TEXT;
  const text = { ...draft.text };
  const automatic = new Set(draft.automatic);
  let differs = false;
  for (const field of ADDRESS_FIELDS) {
    if (draft.text[field] === '' || draft.automatic.has(field)) {
      text[field] = map[field];
      if (map[field]) {
        automatic.add(field);
      } else {
        automatic.delete(field);
      }
    } else if (map[field] && map[field] !== draft.text[field]) {
      differs = true;
    }
  }
  const offer: PlaceOffer = {};
  if (differs) {
    offer.address = {
      street: map.street,
      buildingNum: map.buildingNum,
      postalCode: map.postalCode,
      city: map.city,
    };
  }
  if (found?.offeredName && found.offeredName !== text.venueName) {
    offer.name = found.offeredName;
  }
  return {
    ...draft,
    text,
    automatic,
    countryCode: found?.countryCode ?? draft.countryCode,
    offer: offer.address || offer.name ? offer : null,
  };
}

/** The user typed in a field: it's theirs from now on. */
export function typed(draft: PlaceDraft, field: PlaceField, value: string): PlaceDraft {
  const automatic = new Set(draft.automatic);
  automatic.delete(field);
  return { ...draft, text: { ...draft.text, [field]: value }, automatic };
}

/** The user took the offered address or name. It's theirs, as if they had typed it. */
export function offerTaken(draft: PlaceDraft, part: keyof PlaceOffer): PlaceDraft {
  const offer = draft.offer;
  const taken: Partial<PlaceText> | undefined =
    part === 'name' ? (offer?.name ? { venueName: offer.name } : undefined) : offer?.address;
  if (!offer || !taken) {
    return draft;
  }
  const automatic = new Set(draft.automatic);
  for (const field of Object.keys(taken) as PlaceField[]) {
    automatic.delete(field);
  }
  const rest: PlaceOffer = { ...offer };
  delete rest[part];
  return {
    ...draft,
    text: { ...draft.text, ...taken },
    automatic,
    offer: rest.address || rest.name ? rest : null,
  };
}

/** A place in two lines: its name, or else its street or city, then the rest of its address. */
export function describePlace(text: Partial<PlaceText>): { name: string; address: string } {
  const street = [text.street, text.buildingNum].filter(Boolean).join(' ');
  const town = [text.postalCode, text.city].filter(Boolean).join(' ');
  const lines = [text.venueName, street, town].filter((line): line is string => !!line);
  return { name: lines[0] ?? '', address: lines.slice(1).join(', ') };
}
