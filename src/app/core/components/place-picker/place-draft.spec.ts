import { PlaceSuggestion } from '../../models/common/place-suggestion.model';
import {
  addressFound,
  EMPTY_DRAFT,
  offerTaken,
  picked,
  pinMoved,
  PlaceDraft,
  savedDraft,
  typed,
} from './place-draft';

const ERGO_ARENA: PlaceSuggestion = {
  coordinates: { latitude: 54.4265, longitude: 18.5805 },
  venueName: 'Ergo Arena',
  street: 'Plac Dwóch Miast',
  buildingNum: '1',
  postalCode: '80-344',
  city: 'Gdańsk',
  countryCode: 'PL',
};

const NEXT_DOOR: PlaceSuggestion = {
  coordinates: { latitude: 54.427, longitude: 18.581 },
  offeredName: 'Przystanek Hala Olivia',
  street: 'Aleja Grunwaldzka',
  buildingNum: '470',
  postalCode: '80-309',
  city: 'Gdańsk',
  countryCode: 'PL',
};

const PIN = { latitude: 54.5, longitude: 18.5 };

function movedTo(draft: PlaceDraft, found: PlaceSuggestion | null): PlaceDraft {
  return addressFound(pinMoved(draft, PIN), found);
}

describe('place draft', () => {
  it('a pick replaces every field, the user’s too', () => {
    const mine = typed(picked(ERGO_ARENA), 'venueName', 'Moja nazwa');

    const draft = picked(NEXT_DOOR);

    expect(mine.text.venueName).toBe('Moja nazwa');
    expect(draft.text).toEqual({
      venueName: '',
      street: 'Aleja Grunwaldzka',
      buildingNum: '470',
      postalCode: '80-309',
      city: 'Gdańsk',
    });
    expect(draft.coordinates).toEqual(NEXT_DOOR.coordinates);
    expect(draft.countryCode).toBe('PL');
  });

  it('a pin move fills empty fields and puts the pin where the user put it', () => {
    const draft = movedTo(EMPTY_DRAFT, NEXT_DOOR);

    expect(draft.coordinates).toEqual(PIN);
    expect(draft.text.street).toBe('Aleja Grunwaldzka');
    expect(draft.text.city).toBe('Gdańsk');
    expect(draft.countryCode).toBe('PL');
  });

  it('a pin move replaces automatic fields', () => {
    const draft = movedTo(picked(ERGO_ARENA), NEXT_DOOR);

    expect(draft.text.street).toBe('Aleja Grunwaldzka');
    expect(draft.text.buildingNum).toBe('470');
    expect(draft.offer?.address).toBeUndefined();
  });

  it('a pin move never fills the venue name, only offers it', () => {
    const fromEmpty = movedTo(EMPTY_DRAFT, NEXT_DOOR);
    const fromPick = movedTo(picked(ERGO_ARENA), NEXT_DOOR);

    expect(fromEmpty.text.venueName).toBe('');
    expect(fromEmpty.offer?.name).toBe('Przystanek Hala Olivia');
    expect(fromPick.text.venueName).toBe('Ergo Arena');
  });

  it('a pin move never overwrites typed text, and offers the map’s address instead', () => {
    let draft = picked(ERGO_ARENA);
    draft = typed(draft, 'street', 'Moja ulica');
    draft = typed(draft, 'city', 'Sopot');
    draft = typed(draft, 'venueName', 'Hala');

    draft = movedTo(draft, NEXT_DOOR);

    expect(draft.text).toEqual({
      venueName: 'Hala',
      street: 'Moja ulica',
      buildingNum: '470',
      postalCode: '80-309',
      city: 'Sopot',
    });
    expect(draft.offer?.address).toEqual({
      street: 'Aleja Grunwaldzka',
      buildingNum: '470',
      postalCode: '80-309',
      city: 'Gdańsk',
    });
  });

  it('a pin move on a saved place keeps all of it, since it is the user’s own', () => {
    const saved = savedDraft(
      {
        venueName: 'Hala',
        street: 'Długa',
        buildingNum: '1',
        postalCode: '80-001',
        city: 'Gdańsk',
      },
      ERGO_ARENA.coordinates,
      'PL',
    );

    const draft = movedTo(saved, NEXT_DOOR);

    expect(draft.text).toEqual(saved.text);
    expect(draft.coordinates).toEqual(PIN);
    expect(draft.offer?.address?.street).toBe('Aleja Grunwaldzka');
  });

  it('a pin where the map has no address empties automatic fields and keeps the user’s', () => {
    const draft = movedTo(typed(picked(ERGO_ARENA), 'city', 'Gdańsk'), null);

    expect(draft.text.street).toBe('');
    expect(draft.text.postalCode).toBe('');
    expect(draft.text.city).toBe('Gdańsk');
    expect(draft.offer).toBeNull();
  });

  it('taking the offered address makes it the user’s, and the name stays offered', () => {
    let draft = typed(EMPTY_DRAFT, 'street', 'Moja ulica');
    draft = movedTo(draft, NEXT_DOOR);

    draft = offerTaken(draft, 'address');

    expect(draft.text.street).toBe('Aleja Grunwaldzka');
    expect(draft.automatic.has('street')).toBeFalse();
    expect(draft.offer).toEqual({ name: 'Przystanek Hala Olivia' });

    draft = offerTaken(draft, 'name');

    expect(draft.text.venueName).toBe('Przystanek Hala Olivia');
    expect(draft.offer).toBeNull();
  });
});
