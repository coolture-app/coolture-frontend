import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { defer, map, retry, timer } from 'rxjs';
import { Kind } from '../../models/interests/interest.model';
import { InterestsService } from './interests.service';
import { currentLang } from '../../utils/current-lang';

/** The kind that Filtry shows as a switch rather than a tile: it narrows the other kinds instead of adding to them. */
export const KIDS_KIND = 'kids';

/** The kinds of event and their names, from the cached catalogue. */
@Injectable({
  providedIn: 'root',
})
export class KindsService {
  private interests = inject(InterestsService);
  private translate = inject(TranslateService);

  private lang = currentLang();

  /** In the catalogue's order. Empty on the server and until it loads, so a kind then shows no name. A failed load is tried again. */
  readonly kinds = isPlatformBrowser(inject(PLATFORM_ID))
    ? toSignal(
        defer(() => this.interests.getCatalog()).pipe(
          map((catalog) => catalog.kinds as readonly Kind[]),
          retry({ delay: (_error, attempt) => timer(Math.min(1000 * 2 ** (attempt - 1), 30_000)) }),
        ),
        { initialValue: [] as readonly Kind[] },
      )
    : signal<readonly Kind[]>([]).asReadonly();

  private names = computed(() => {
    const en = this.lang() === 'en';
    return new Map(this.kinds().map((kind) => [kind.key, en ? kind.labelEn : kind.labelPl]));
  });

  name(key: string): string | null {
    return this.names().get(key) ?? null;
  }

  /**
   * One post's kind in words, before its date: "Koncert" where the catalogue says "Koncerty". The catalogue's name
   * for a kind the frontend has no word for.
   */
  eventName(key: string): string | null {
    this.lang();
    const id = `KINDS.one.${key}`;
    const word: string = this.translate.instant(id);
    return word !== id ? word : this.name(key);
  }
}
