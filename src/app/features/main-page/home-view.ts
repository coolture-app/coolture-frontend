import { inject, Injectable } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Params } from '@angular/router';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostsSort } from '../../core/models/common/enums';
import { PostListQuery, PostListStore } from '../../core/services/post-list/post-list.store';

const RESTORE_WINDOW_MS = 30 * 60 * 1000;

/**
 * What the radius filter is centred on: the user's position, or a place that was picked. A link is the
 * only way to pick one so far; the geocoder's place picker will fill the same slot.
 */
export type PlaceFilter = '' | 'mine' | 'picked';

/** The filter panel's values, as its form holds them. */
export const NO_FILTERS = {
  type: '',
  tags: '',
  startsFrom: '',
  startsTo: '',
  visibility: '',
  status: '',
  includePast: false,
  /** The radius filter's centre, as a place from `PlaceFilter`, or '' for "Wszędzie". */
  place: '' as PlaceFilter,
  radiusKm: 5,
};
export type FilterValues = typeof NO_FILTERS;

/** The radius choices of the location filter, in km. */
export const RADII_KM = [1, 5, 10, 25, 50, 100];

/** The home page's two lists: the ranked feed of posts new to the user, and every post. */
export type HomeTab = 'forYou' | 'all';
/** Wszystkie's order until the user picks another: what's on next, as a calendar shows it. */
export const START_SORT: PostsSort = 'UPCOMING';

/** The filter panel's form, one control per value in NO_FILTERS. */
export function createFiltersForm() {
  return new FormGroup({
    type: new FormControl(NO_FILTERS.type, { nonNullable: true }),
    tags: new FormControl(NO_FILTERS.tags, { nonNullable: true }),
    startsFrom: new FormControl(NO_FILTERS.startsFrom, { nonNullable: true }),
    startsTo: new FormControl(NO_FILTERS.startsTo, { nonNullable: true }),
    visibility: new FormControl(NO_FILTERS.visibility, { nonNullable: true }),
    status: new FormControl(NO_FILTERS.status, { nonNullable: true }),
    includePast: new FormControl(NO_FILTERS.includePast, { nonNullable: true }),
    place: new FormControl(NO_FILTERS.place, { nonNullable: true }),
    radiusKm: new FormControl(NO_FILTERS.radiusKm, { nonNullable: true }),
  });
}
export type FiltersForm = ReturnType<typeof createFiltersForm>;

/** What the home page needs to look the same when the user comes back to it. */
export interface HomeView {
  search: string;
  filters: FilterValues;
  tab: HomeTab;
  sort: PostsSort;
  isMapView: boolean;
  /** Where the list under the map was scrolled to. The router restores only the page's own scroll. */
  listScrollY: number;
  /** The position the location filter used. Kept in memory for this visit only. */
  nearPosition: GeoPoint | null;
  /** The place the filter can centre on instead, which so far comes from a link. */
  pickedPlace: GeoPoint | null;
  /** The query string this view had, to tell whether a return to the page is a return to this view. */
  url: Params;
}

/**
 * The home page as it was left. It describes one list, so it's given back only while the store still
 * holds that list: a new list, or a cleared one after the user changed, makes it stale.
 */
@Injectable({
  providedIn: 'root',
})
export class HomeViewMemory {
  private list = inject(PostListStore);
  private saved: { view: HomeView; query: PostListQuery | null; at: number } | null = null;

  save(view: HomeView): void {
    this.saved = { view, query: this.list.query(), at: Date.now() };
  }

  /** The view to go back to, unless it was left too long ago to still feel like the same visit. */
  restore(): HomeView | null {
    const saved = this.saved;
    const current = saved && saved.query === this.list.query();
    return current && Date.now() - saved.at < RESTORE_WINDOW_MS ? saved.view : null;
  }
}
