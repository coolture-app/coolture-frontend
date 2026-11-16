import { PostMark } from '../../models/posts/post-mark.model';
import { Component, input, output } from '@angular/core';
import { MapComponent, MarkerComponent } from '@maplibre/ngx-maplibre-gl';

/** Stands in for `mgl-map` in specs, so they never start WebGL or fetch tiles. */
// eslint-disable-next-line @angular-eslint/component-selector -- must match the library's selector
@Component({ selector: 'mgl-map', template: '<ng-content />' })
export class MapStub {
  readonly style = input<unknown>();
  readonly center = input<unknown>();
  readonly zoom = input<unknown>();
  readonly cooperativeGestures = input<unknown>();
  readonly attributionControl = input<unknown>();
  readonly mapLoad = output<unknown>();
  readonly mapError = output<unknown>();
  readonly mapClick = output<unknown>();
}

// eslint-disable-next-line @angular-eslint/component-selector -- must match the library's selector
@Component({ selector: 'mgl-marker', template: '<ng-content />' })
export class MarkerStub {
  readonly lngLat = input<unknown>();
  readonly draggable = input<unknown>();
  readonly anchor = input<unknown>();
  readonly markerDragEnd = output<unknown>();
}

export const WITHOUT_MAPLIBRE = {
  remove: { imports: [MapComponent, MarkerComponent] },
  add: { imports: [MapStub, MarkerStub] },
};

/** A post's mark at (latitude, 18.6) in Gdańsk. */
export function mark(id: string, latitude = 54.35): PostMark {
  return {
    id,
    title: id,
    startsAt: '2026-12-01T18:00:00Z',
    positiveReactionCount: 0,
    interestedCount: 0,
    goingCount: 0,
    coordinates: { latitude, longitude: 18.6 },
    city: 'Gdańsk',
  };
}
