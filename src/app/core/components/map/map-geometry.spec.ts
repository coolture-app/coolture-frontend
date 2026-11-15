import { fitPin } from './map-geometry';

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
