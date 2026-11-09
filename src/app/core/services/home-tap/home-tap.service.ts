import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * The Home icon tapped while already at the top of the home page, which asks for a fresh feed.
 * The navbar sends it and the home page acts on it, so neither needs the other.
 */
@Injectable({
  providedIn: 'root',
})
export class HomeTapService {
  readonly freshFeed = new Subject<void>();
}
