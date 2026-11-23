import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { GeoPoint, NamedPlace, TRICITY } from '../../core/models/common/geo.model';
import { HomePlace } from './home-place';

describe('HomePlace', () => {
  const home = signal<NamedPlace | null>(null);
  const radiusCentre = signal<GeoPoint | null>(null);
  const oliwa: NamedPlace = {
    name: 'Oliwa, Gdańsk',
    coordinates: { latitude: 54.41, longitude: 18.56 },
  };
  const point = { latitude: 54.52, longitude: 18.54 };

  beforeEach(() => {
    home.set(null);
    radiusCentre.set(null);
  });

  it('measures from the radius, then the position, then a picked place, then the home, then Trójmiasto', () => {
    const place = new HomePlace(home, radiusCentre, () => of(null));
    expect(place.searchNear()).toEqual(TRICITY);

    home.set(oliwa);
    expect(place.sortPoint()).toEqual(oliwa.coordinates);
    expect(place.own()).toBeNull();

    place.pick({ name: 'Gdynia', coordinates: point });
    expect(place.sortPoint()).toEqual(point);

    place.position.set({ latitude: 54.35, longitude: 18.65 });
    expect(place.own()).toEqual({ latitude: 54.35, longitude: 18.65 });

    radiusCentre.set({ latitude: 54.4, longitude: 18.6 });
    expect(place.searchNear()).toEqual({ latitude: 54.4, longitude: 18.6 });
  });

  it('names a point by the area around it', async () => {
    const place = new HomePlace(home, radiusCentre, () =>
      of({ name: 'Gdynia', coordinates: point }),
    );

    place.pickPoint(point);
    await Promise.resolve();

    expect(place.picked()).toEqual({ name: 'Gdynia', coordinates: point });
    expect(place.centre('picked')).toEqual(point);
  });

  it('keeps a newer place when an older lookup answers late, and no name when it fails', async () => {
    const answer = new Subject<NamedPlace | null>();
    const place = new HomePlace(home, radiusCentre, () => answer);

    place.pickPoint(point);
    place.pick(oliwa);
    answer.next({ name: 'Gdynia', coordinates: point });
    answer.complete();
    await Promise.resolve();
    expect(place.picked()).toEqual(oliwa);

    const failing = new HomePlace(home, radiusCentre, () => throwError(() => new Error('down')));
    failing.pickPoint(point);
    await Promise.resolve();
    expect(failing.picked()).toEqual({ name: '', coordinates: point });
  });
});
