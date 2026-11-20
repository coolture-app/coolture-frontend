import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';
import { KIDS_KIND } from '../../icons/kind-icons';
import { Kind } from '../../models/interests/interest.model';
import { InterestsService } from './interests.service';

/**
 * The kinds of event and their names, from the cached catalogue. It's asked for only once a name is first read, so
 * pages that show no kind, such as a list of cards, don't load it.
 */
@Injectable({
  providedIn: 'root',
})
export class KindsService {
  private interests = inject(InterestsService);
  private translate = inject(TranslateService);

  private lang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });
  private loaded = signal<readonly Kind[]>([]);
  private requested = false;

  /** In the catalogue's order. Empty until loaded, and if loading failed, so a kind then shows no name. */
  readonly kinds = computed(() => {
    this.request();
    return this.loaded();
  });
  /** Filtry's tiles: every kind but Dla dzieci, which is a switch there. */
  readonly tileKinds = computed(() => this.kinds().filter((kind) => kind.key !== KIDS_KIND));

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

  /** Later, since a cached catalogue answers at once, and a signal can't be set while a computed one is read. */
  private request(): void {
    if (this.requested) {
      return;
    }
    this.requested = true;
    queueMicrotask(() =>
      this.interests
        .getCatalog()
        .pipe(
          map((catalog) => catalog.kinds),
          catchError(() => of([] as Kind[])),
        )
        .subscribe((kinds) => this.loaded.set(kinds)),
    );
  }
}
