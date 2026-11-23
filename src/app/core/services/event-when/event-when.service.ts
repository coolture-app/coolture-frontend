import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { cardWhen, EventTimes, pageWhen, WhenWords } from '../../utils/event-time';
import { currentLang } from '../../utils/current-lang';

/** Says when an event is, in the app's language. Signals, so a template re-renders when the language changes. */
@Injectable({ providedIn: 'root' })
export class EventWhenService {
  private translate = inject(TranslateService);
  private readonly words = toSignal(this.translate.stream('EVENT_TIME'), { initialValue: null });
  private readonly lang = currentLang();

  /** For cards and the map's preview. */
  card(post: EventTimes, now = new Date()): string {
    const words = this.loadedWords();
    return words ? cardWhen(post, now, this.lang(), words) : '';
  }

  /** For the post's page. */
  page(post: EventTimes, now = new Date()): string {
    const words = this.loadedWords();
    return words ? pageWhen(post, now, this.lang(), words) : '';
  }

  /** Before the translations load, the stream gives the key itself. */
  private loadedWords(): WhenWords | null {
    const words = this.words();
    return words && typeof words === 'object' ? (words as WhenWords) : null;
  }
}
