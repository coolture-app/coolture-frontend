import { Injectable } from '@angular/core';

/** Where the home map was and which pin was open, for Back from a post. Memory only, for this visit. */
export interface MapView {
  center: [number, number];
  zoom: number;
  selected: string | null;
  /** The post opened from the selected place's list. */
  opened: string | null;
}

@Injectable({ providedIn: 'root' })
export class MapMemory {
  view: MapView | null = null;
}
