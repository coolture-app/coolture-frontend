import { InitialsPipe } from './initials.pipe';

describe('InitialsPipe', () => {
  const initials = new InitialsPipe();

  it('takes the first name, else the username, never nothing', () => {
    expect(initials.transform({ firstName: 'łucja', lastName: 'Nowak', username: 'anna' })).toBe(
      'Ł',
    );
    expect(initials.transform({ lastName: 'Nowak', username: 'ola' })).toBe('O');
    expect(initials.transform({ firstName: ' ', lastName: '', username: 'jan_demo' })).toBe('J');
    expect(initials.transform(null)).toBe('');
  });
});
