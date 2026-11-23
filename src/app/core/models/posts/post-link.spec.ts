import { linkName, linkUrl } from './post-link';

describe('post links', () => {
  it('shows the name, or the domain without www', () => {
    expect(linkName({ url: 'https://www.bilety.pl/koncert', label: 'Bilety' })).toBe('Bilety');
    expect(linkName({ url: 'https://www.bilety.pl/koncert' })).toBe('bilety.pl');
    expect(linkName({ url: 'https://fb.com/events/1' })).toBe('fb.com');
  });

  it('adds https to an address typed without a scheme, and keeps one that has it', () => {
    expect(linkUrl(' bilety.pl/koncert ')).toBe('https://bilety.pl/koncert');
    expect(linkUrl('http://bilety.pl')).toBe('http://bilety.pl');
    expect(linkUrl('HTTPS://bilety.pl')).toBe('HTTPS://bilety.pl');
  });
});
