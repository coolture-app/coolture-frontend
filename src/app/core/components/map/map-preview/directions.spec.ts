import { directionsUrl } from './directions';

describe('directionsUrl', () => {
  const at = { latitude: 54.5165, longitude: 18.5455 };

  it('opens Apple Maps on an iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(directionsUrl(at, ua)).toBe('https://maps.apple.com/?daddr=54.5165,18.5455');
  });

  it('opens Google Maps directions elsewhere', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile';
    expect(directionsUrl(at, ua)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=54.5165,18.5455',
    );
  });
});
