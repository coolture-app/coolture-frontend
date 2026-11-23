import { fitPin, startStep } from './map-geometry';

describe('fitPin', () => {
  const view = { left: 0, top: 0, right: 800, bottom: 600 };

  it('leaves a pin whose card fits below it', () => {
    expect(fitPin({ x: 400, y: 100 }, view, 300, 24, 18)).toEqual({ dx: 0, dy: 0 });
  });

  it('leaves a pin whose card fits above it', () => {
    expect(fitPin({ x: 400, y: 500 }, view, 300, 24, 18)).toEqual({ dx: 0, dy: 0 });
  });

  it('moves a pin only as far as its card needs, towards the nearer side with room', () => {
    // Below needs y <= 258, above needs y >= 342.
    expect(fitPin({ x: 400, y: 280 }, view, 300, 24, 18)).toEqual({ dx: 0, dy: -22 });
    expect(fitPin({ x: 400, y: 330 }, view, 300, 24, 18)).toEqual({ dx: 0, dy: 12 });
  });

  it('brings a pin in from the edges', () => {
    expect(fitPin({ x: 790, y: 5 }, view, 0, 24, 18)).toEqual({ dx: -14, dy: 19 });
  });

  it('keeps a pin above a sheet that covers the bottom', () => {
    expect(fitPin({ x: 200, y: 500 }, { ...view, bottom: 350 }, 0, 24, 18)).toEqual({
      dx: 0,
      dy: -174,
    });
  });

  it('puts a pin at the top when its card fits on neither side', () => {
    expect(fitPin({ x: 400, y: 300 }, view, 700, 24, 18)).toEqual({ dx: 0, dy: -276 });
  });
});

describe('startStep', () => {
  const view = { west: 18.5, south: 54.3, east: 18.7, north: 54.4 };
  const centre = { latitude: 54.35, longitude: 18.6 };
  const at = (latitude: number, longitude: number) => ({ coordinates: { latitude, longitude } });

  it('is done when the view holds enough pins', () => {
    expect(startStep(view, centre, [at(54.31, 18.6), at(54.39, 18.6)], 2)).toBe('enough');
  });

  it('looks wider when fewer pins are loaded at all', () => {
    expect(startStep(view, centre, [at(54.5, 18.6)], 2)).toBe('wider');
  });

  it('fits the centre and the nearest pins outside the view', () => {
    const marks = [at(54.31, 18.6), at(55, 18.6), at(54.45, 18.6)];
    expect(startStep(view, centre, marks, 2)).toEqual([
      centre,
      { latitude: 54.31, longitude: 18.6 },
      { latitude: 54.45, longitude: 18.6 },
    ]);
  });
});
