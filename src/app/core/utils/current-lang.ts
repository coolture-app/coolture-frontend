import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

/** The app's language, which the navbar can change at any time. Call in an injection context. */
export function currentLang(): Signal<string> {
  const translate = inject(TranslateService);
  return toSignal(translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: translate.getCurrentLang() || 'pl',
  });
}
