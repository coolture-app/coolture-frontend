import { centredView, clampView, coverScale, MAX_ZOOM, sourceSquare, zoomAt } from './avatar-crop';

describe('avatar crop', () => {
  // A landscape photo, 400 × 200, in a 100 px circle.
  const W = 400;
  const H = 200;
  const SIZE = 100;

  it('covers the circle with the shorter side', () => {
    expect(coverScale(W, H, SIZE)).toBe(0.5);
  });

  it('starts centred', () => {
    expect(centredView(W, H, SIZE)).toEqual({ x: -50, y: 0, scale: 0.5 });
  });

  it('never lets an edge into the circle', () => {
    expect(clampView({ x: 30, y: 30, scale: 0.5 }, W, H, SIZE)).toEqual({ x: 0, y: 0, scale: 0.5 });
    expect(clampView({ x: -500, y: -500, scale: 0.5 }, W, H, SIZE)).toEqual({
      x: -100,
      y: 0,
      scale: 0.5,
    });
  });

  it('zooms between covering and MAX_ZOOM times that', () => {
    expect(clampView({ x: 0, y: 0, scale: 0.1 }, W, H, SIZE).scale).toBe(0.5);
    expect(clampView({ x: 0, y: 0, scale: 9 }, W, H, SIZE).scale).toBe(0.5 * MAX_ZOOM);
  });

  it('keeps the point under the cursor still while zooming', () => {
    const before = { x: -50, y: 0, scale: 0.5 };
    const after = zoomAt(before, 1, 25, 75);
    const underBefore = { x: (25 - before.x) / before.scale, y: (75 - before.y) / before.scale };
    const underAfter = { x: (25 - after.x) / after.scale, y: (75 - after.y) / after.scale };
    expect(underAfter).toEqual(underBefore);
  });

  it('cuts the square the circle shows, in the photo’s pixels', () => {
    expect(sourceSquare({ x: -50, y: 0, scale: 0.5 }, SIZE)).toEqual({
      sx: 100,
      sy: -0,
      side: 200,
    });
  });
});
