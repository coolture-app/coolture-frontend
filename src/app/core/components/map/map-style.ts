import type { Map as MapLibreMap } from 'maplibre-gl';

/** OpenFreeMap's vector tiles: free, no key, and its own attribution control credits OpenStreetMap. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** MapLibre opens the compact credit, which covers a third of a phone-sized map. It stays one tap away. */
export function collapseCredit(map: MapLibreMap): void {
  map
    .getContainer()
    .querySelector('.maplibregl-ctrl-attrib')
    ?.classList.remove('maplibregl-compact-show');
}

/** The middle of Trójmiasto, where the release starts. */
export const TRICITY = { latitude: 54.44, longitude: 18.57 };
