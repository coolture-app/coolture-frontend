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

/** The middle of Trójmiasto, where the release starts. */
export const TRICITY = { latitude: 54.44, longitude: 18.57 };

/** The name field each language's labels read first; anything else falls back to the local name. */
const LABEL_FIELDS: Record<string, string> = { pl: 'name:pl', en: 'name_en' };

/**
 * Labels in the app's language. Liberty reads `name_en` before the local name, so a Polish app said "Bay of Puck".
 * Its labels pick the name with `["coalesce", ["get", <field>], ["get", "name"]]`, and only that field is swapped.
 */
export function labelLanguage(map: MapLibreMap, lang: string): void {
  const field = LABEL_FIELDS[lang.slice(0, 2)] ?? 'name_en';
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') {
      continue;
    }
    const text = map.getLayoutProperty(layer.id, 'text-field');
    const swapped = swapNameField(text, field);
    if (swapped !== text) {
      map.setLayoutProperty(layer.id, 'text-field', swapped);
    }
  }
}

/** Labels in the app's language now and after every switch. The caller ends the subscription with the map. */
export function followLanguage(map: MapLibreMap, translate: TranslateService): Subscription {
  labelLanguage(map, translate.getCurrentLang() || 'pl');
  return translate.onLangChange.subscribe(({ lang }) => labelLanguage(map, lang));
}

function swapNameField(expression: unknown, field: string): unknown {
  if (!Array.isArray(expression)) {
    return expression;
  }
  const [op, first, second] = expression;
  if (
    op === 'coalesce' &&
    Array.isArray(first) &&
    first[0] === 'get' &&
    Object.values(LABEL_FIELDS).includes(first[1]) &&
    JSON.stringify(second) === '["get","name"]'
  ) {
    return first[1] === field ? expression : ['coalesce', ['get', field], second];
  }
  const parts = expression.map((part) => swapNameField(part, field));
  return parts.some((part, i) => part !== expression[i]) ? parts : expression;
}
