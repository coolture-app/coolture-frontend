import type { Map as MapLibreMap } from 'maplibre-gl';
import type { TranslateService } from '@ngx-translate/core';
import type { Subscription } from 'rxjs';

/** OpenFreeMap's vector tiles: free, no key, and its own attribution control credits OpenStreetMap. */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** MapLibre opens the compact credit, which covers a third of a phone-sized map. It stays one tap away. */
export function collapseCredit(map: MapLibreMap): void {
  map
    .getContainer()
    .querySelector('.maplibregl-ctrl-attrib')
    ?.classList.remove('maplibregl-compact-show');
}

/**
 * Liberty's layers name a few icons its sprite lacks (gates, bollards, recycling), and MapLibre warns about each in
 * the console, again on every tile. An empty image hides them as they'd be hidden anyway. Listeners added before this
 * one, such as the home map's own pills, draw first.
 */
export function quietMissingIcons(map: MapLibreMap): void {
  map.on('styleimagemissing', ({ id }: { id: string }) => {
    if (!map.hasImage(id)) {
      map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    }
  });
}

/** The middle of Trójmiasto, where the release starts. */
export const TRICITY = { latitude: 54.44, longitude: 18.57 };

/** Each map's labels as Liberty wrote them, to go back to in English. */
const libertyLabels = new WeakMap<MapLibreMap, Map<string, unknown>>();

/**
 * Labels in the app's language. Liberty reads English first (`name_en`), and Latin with Cyrillic where a place has
 * both, so a Polish app said "Bay of Puck" and "Gulf of Gdansk Гданьская бухта". In Polish the Polish name comes
 * first, then Liberty's choice with the local name in place of the English one; in English, Liberty's own.
 */
export function labelLanguage(map: MapLibreMap, lang: string): void {
  let labels = libertyLabels.get(map);
  if (!labels) {
    labels = new Map();
    for (const layer of map.getStyle().layers) {
      const text = layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'text-field');
      if (JSON.stringify(text ?? null).includes('"name_en"')) {
        labels.set(layer.id, text);
      }
    }
    libertyLabels.set(map, labels);
  }
  const polish = lang.startsWith('pl');
  for (const [id, text] of labels) {
    map.setLayoutProperty(
      id,
      'text-field',
      polish ? ['coalesce', ['get', 'name:pl'], localName(text)] : text,
    );
  }
}

/** Labels in the app's language now and after every switch. The caller ends the subscription with the map. */
export function followLanguage(map: MapLibreMap, translate: TranslateService): Subscription {
  labelLanguage(map, translate.getCurrentLang() || 'pl');
  return translate.onLangChange.subscribe(({ lang }) => labelLanguage(map, lang));
}

function localName(expression: unknown): unknown {
  if (!Array.isArray(expression)) {
    return expression;
  }
  return expression[0] === 'get' && expression[1] === 'name_en'
    ? ['get', 'name']
    : expression.map(localName);
}
