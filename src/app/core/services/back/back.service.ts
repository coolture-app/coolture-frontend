import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser, Location } from '@angular/common';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { OVERLAY_ENTRY } from '../back-closable/back-closable';
import { fromHomeParams } from '../../../features/main-page/home-url';

/** A page's name: a translation key, or text as it is, such as a username. */
export type PageLabel = { key: string } | { text: string };

export interface BackTarget {
  url: string;
  label: PageLabel;
}

/** One history entry the router made, or several when only its query or fragment changed. */
interface Entry {
  id: string;
  url: string;
  /** The entry one Back away, if this tab made it since the app loaded. */
  prev: string | null;
  /** The address of an overlay's entry between `prev` and this one, which Back shows instead. */
  via: string | null;
}

interface Leaving {
  id: number;
  imperative: boolean;
  state: Record<string, unknown> | null;
  url: string;
}

/** Kept in each entry's history state, so Back and Forward find the entry again. */
const ENTRY_KEY = 'backEntry';
/** Per load, so an entry from before a reload never matches one made after it. */
const LOAD = Math.random().toString(36).slice(2, 8);

/**
 * The back link's destination, and going there. Going back in history, as the browser's Back does, lets
 * the router put the scroll back and the home page restore its list. The router's page id can't key the
 * entries: a link in the comments sheet replaces the sheet's entry, which carries the page's state, so
 * two entries share one id.
 */
@Injectable({
  providedIn: 'root',
})
export class BackService {
  private router = inject(Router);
  private location = inject(Location);

  private entries = new Map<string, Entry>();
  private current = signal<Entry | null>(null);
  private postTitles = signal<ReadonlyMap<string, string>>(new Map());
  private leaving: Leaving | null = null;
  private count = 0;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        // Before the router touches history, so the browser is still on the page being left.
        this.leaving = {
          id: event.id,
          imperative: event.navigationTrigger === 'imperative',
          state: this.state(),
          // Location leaves out the slash before a query: the router's form, as the URLs it gives.
          url: this.router.serializeUrl(this.router.parseUrl(this.location.path(true))),
        };
      } else if (event instanceof NavigationEnd && event.id === this.leaving?.id) {
        this.arrived(event.urlAfterRedirects, this.leaving);
      }
    });
  }

  /** Where `back` goes: the page before in this tab, or else `fallback`. */
  target(fallback: string): BackTarget {
    const entry = this.current();
    const prev = entry?.prev ? this.entries.get(entry.prev) : undefined;
    const url = prev ? (entry?.via ?? prev.url) : fallback;
    return { url, label: this.label(url) };
  }

  /** Back when the page before is in this app. Otherwise `fallback`, in place of this page. */
  back(fallback: string): void {
    const prev = this.current()?.prev;
    if (prev && this.entries.has(prev)) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(fallback, { replaceUrl: true });
    }
  }

  /** A post's page is named by its title, once the title is known. */
  rememberPostTitle(id: string, title: string): void {
    if (this.postTitles().get(id) !== title) {
      this.postTitles.update((titles) => new Map(titles).set(id, title));
    }
  }

  /** Reads the post titles, so a name shown updates once its title is known. */
  private label(url: string): PageLabel {
    const tree = this.router.parseUrl(url);
    const [first = '', second = '', third] =
      tree.root.children['primary']?.segments.map((segment) => segment.path) ?? [];
    switch (first) {
      case '': {
        const home = fromHomeParams(tree.queryParams);
        return {
          key: home.map
            ? 'MAIN_PAGE.map'
            : home.tab === 'all'
              ? 'MAIN_PAGE.all'
              : 'MAIN_PAGE.forYou',
        };
      }
      case 'people':
        return { key: 'PEOPLE.title' };
      case 'plans':
        return { key: 'PLANS.title' };
      case 'users':
        return second ? { text: `@${second}` } : { key: 'BACK.previous' };
      case 'profile':
        return { key: PROFILE_PAGES[second] ?? 'BACK.previous' };
      case 'posts': {
        if (second === 'new') return { key: 'ADD_POST.title' };
        if (third === 'edit') return { key: 'EDIT_POST.title' };
        const title = this.postTitles().get(second);
        return title ? { text: title } : { key: 'BACK.post' };
      }
      default:
        return { key: 'BACK.previous' };
    }
  }

  private arrived(url: string, leaving: Leaving): void {
    const state = this.state();
    const own = this.entries.get(String(state?.[ENTRY_KEY]));
    let entry: Entry;
    if (!leaving.imperative) {
      // Back or Forward: the entry this tab made, or one from before a reload, which has no page before it here.
      entry = own ? { ...own, url } : this.newEntry(url, null, null);
    } else {
      const from = this.entries.get(String(leaving.state?.[ENTRY_KEY]));
      const fromOverlay = !!leaving.state?.[OVERLAY_ENTRY];
      const pageId = leaving.state?.['ɵrouterPageId'];
      const pushed = typeof pageId === 'number' && state?.['ɵrouterPageId'] === pageId + 1;
      if (!from) {
        entry = this.newEntry(url, null, null);
      } else if (pushed) {
        entry = this.newEntry(url, from.id, fromOverlay ? leaving.url : null);
      } else if (pathOf(from.url) === pathOf(url)) {
        // The home page's filters replace its URL, and stay one page.
        entry = { ...from, url };
      } else if (fromOverlay) {
        // A link in the comments sheet takes over the sheet's entry, so the page under it is one Back away.
        entry = this.newEntry(url, from.id, null);
      } else {
        entry = this.newEntry(url, from.prev, from.via);
      }
    }
    this.entries.set(entry.id, entry);
    this.current.set(entry);
    if (state?.[ENTRY_KEY] !== entry.id) {
      // The router writes its own state on each navigation, and keeps the rest only on Back and Forward.
      this.location.replaceState(this.location.path(true), '', { ...state, [ENTRY_KEY]: entry.id });
    }
  }

  private newEntry(url: string, prev: string | null, via: string | null): Entry {
    return { id: `${LOAD}-${++this.count}`, url, prev, via };
  }

  private state(): Record<string, unknown> | null {
    const state = this.location.getState();
    return state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
  }
}

const PROFILE_PAGES: Record<string, string> = {
  '': 'PROFILE.title',
  settings: 'SETTINGS.title',
  blocked: 'BLOCKED.title',
  hidden: 'HIDDEN.title',
  interests: 'INTERESTS.title',
};

export function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}
