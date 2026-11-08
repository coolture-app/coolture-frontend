import { inject, Injectable } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { GeoPoint } from '../../core/models/common/geo.model';
import { PostsSort } from '../../core/models/common/enums';
import { PostListQuery, PostListStore } from '../../core/services/post-list/post-list.store';

/** Navigation state that asks the home page to put the list back, as the browser's Back does. */
export const RESTORE_LIST_KEY = 'restoreList';

const RESTORE_WINDOW_MS = 30 * 60 * 1000;

/** The filter panel's values, as its form holds them. */
export const NO_FILTERS = {
  type: '',
  tags: '',
  startsFrom: '',
  startsTo: '',
  visibility: '',
  status: '',
  includePast: false,
  /** "Moja lokalizacja" instead of "Wszędzie", within `radiusKm` of the user's position. */
  near: false,
  radiusKm: 5,
};
export type FilterValues = typeof NO_FILTERS;

/** The radius choices of the location filter, in km. */
export const RADII_KM = [1, 5, 10, 25, 50, 100];

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
    near: new FormControl(NO_FILTERS.near, { nonNullable: true }),
    radiusKm: new FormControl(NO_FILTERS.radiusKm, { nonNullable: true }),
  });
}
export type FiltersForm = ReturnType<typeof createFiltersForm>;

/** What the home page needs to look the same when the user comes back to it. */
export interface HomeView {
  search: string;
  filters: FilterValues;
  pickedSort: PostsSort | null;
  isMapView: boolean;
  scrollY: number;
  /** The position the location filter used. Kept in memory for this visit only, never stored. */
  nearPosition: GeoPoint | null;
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
