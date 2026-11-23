import { formatDistance } from './distance';

describe('formatDistance', () => {
  it('shows metres under a kilometre, to 50 m, and never 0', () => {
    expect(formatDistance(830, 'pl')).toBe('850 m');
    expect(formatDistance(12, 'pl')).toBe('50 m');
  });

  it('shows one decimal under ten kilometres, with the decimal mark of the language', () => {
    expect(formatDistance(2340, 'pl')).toBe('2,3 km');
    expect(formatDistance(2340, 'en')).toBe('2.3 km');
    expect(formatDistance(1000, 'pl')).toBe('1,0 km');
  });

  it('shows whole kilometres from ten up', () => {
    expect(formatDistance(12_600, 'pl')).toBe('13 km');
  });
});
