import { Pipe, PipeTransform } from '@angular/core';

interface Person {
  firstName?: string;
  lastName?: string;
  username?: string;
}

/** An avatar's letters without a photo: the first and last name's, else the username's first, never nothing. */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(person: Person | null | undefined): string {
    if (!person) {
      return '';
    }
    const names = [person.firstName, person.lastName]
      .map((n) => n?.trim().charAt(0) ?? '')
      .join('');
    return (names || person.username?.charAt(0) || '').toUpperCase();
  }
}
