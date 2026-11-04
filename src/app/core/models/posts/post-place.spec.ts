import { postPlace } from './post-place';
import { EventLocation } from '../common/geo.model';
import { PostType } from '../common/enums';

function place(location: Partial<EventLocation> | undefined, withAddress = false, type?: PostType) {
  const full = location && { id: 'l1', coordinates: { latitude: 54, longitude: 18 }, ...location };
  return postPlace({ type: type ?? 'OFFLINE', location: full }, withAddress);
}

describe('postPlace', () => {
  it('shows the venue and city on a card', () => {
    expect(
      place({ venueName: 'Ergo Arena', city: 'Gdańsk', street: 'Plac', buildingNum: '1' }),
    ).toBe('Ergo Arena, Gdańsk');
  });

  it('shows just the city when there is no venue', () => {
    expect(place({ city: 'Sopot' })).toBe('Sopot');
  });

  it('adds the street and number on the post page', () => {
    expect(
      place(
        { venueName: 'Ergo Arena', street: 'Plac Dwóch Miast', buildingNum: '1', city: 'Gdańsk' },
        true,
      ),
    ).toBe('Ergo Arena, Plac Dwóch Miast 1, Gdańsk');
  });

  it('leaves no stray commas when parts are missing', () => {
    expect(place({ street: 'Długa', city: 'Gdańsk' }, true)).toBe('Długa, Gdańsk');
    expect(place({ venueName: 'Ergo Arena' }, true)).toBe('Ergo Arena');
    expect(place({ city: 'Gdańsk' }, true)).toBe('Gdańsk');
  });

  it('never shows a building number with no street', () => {
    expect(place({ buildingNum: '47', city: 'Gdańsk' }, true)).toBe('Gdańsk');
  });

  it('is empty for an online post, and for a post with no address', () => {
    expect(place({ city: 'Gdańsk' }, true, 'ONLINE')).toBe('');
    expect(place(undefined)).toBe('');
    expect(place({})).toBe('');
  });
});
