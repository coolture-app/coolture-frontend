import { Pipe, PipeTransform } from '@angular/core';

interface Person {
  firstName?: string;
  lastName?: string;
  username?: string;
}

/** An avatar's letter without a photo: the first name's first, else the username's, never nothing. */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(person: Person | null | undefined): string {
    if (!person) {
      return '';
    }
    return (person.firstName?.trim().charAt(0) || person.username?.charAt(0) || '').toUpperCase();
  }
}
