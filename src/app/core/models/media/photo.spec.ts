import { frameShape, toPhoto } from './photo';

describe('frameShape', () => {
  it('is the photo’s own shape within the limits', () => {
    expect(frameShape({ url: 'x', width: 1200, height: 1200 })).toBe(1);
    expect(frameShape({ url: 'x', width: 1600, height: 1200 })).toBeCloseTo(4 / 3);
  });

  it('holds a tall poster at 4:5 and a panorama at 1.91:1', () => {
    expect(frameShape({ url: 'x', width: 1080, height: 1920 })).toBe(0.8);
    expect(frameShape({ url: 'x', width: 3000, height: 1000 })).toBe(1.91);
  });

  it('is square when the size is unknown', () => {
    expect(frameShape({ url: 'x' })).toBe(1);
    expect(frameShape(undefined)).toBe(1);
  });

  it('takes the size from a media resource, and leaves out one with no URL', () => {
    expect(toPhoto({ id: 'm', url: 'u', width: 10, height: 20 })).toEqual({
      url: 'u',
      width: 10,
      height: 20,
    });
    expect(toPhoto({ id: 'm' })).toBeNull();
  });
});
