import { InitialsPipe } from './initials.pipe';

describe('InitialsPipe', () => {
  const initials = new InitialsPipe();

  it('takes the names, else the username, never nothing', () => {
    expect(initials.transform({ firstName: 'Anna', lastName: 'łódzka', username: 'anna' })).toBe(
      'AŁ',
    );
    expect(initials.transform({ firstName: 'Ola', username: 'ola' })).toBe('O');
    expect(initials.transform({ firstName: ' ', lastName: '', username: 'jan_demo' })).toBe('J');
    expect(initials.transform(null)).toBe('');
  });
});
