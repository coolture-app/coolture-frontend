import { DestroyRef, inject, Signal, signal } from '@angular/core';

/** Phones are narrower, as `max-width: 639px` in the styles: the map's sheet, the toolbar's icons. */
export const WIDE_FROM_PX = 640;

/** Whether a media query matches, kept up to date while its caller lives. False on the server. Call in a constructor or field. */
export function mediaQuery(query: string): Signal<boolean> {
  const matches = signal(false);
  if (typeof window !== 'undefined') {
    const list = window.matchMedia(query);
    const update = () => matches.set(list.matches);
    update();
    list.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => list.removeEventListener('change', update));
  }
  return matches.asReadonly();
}
