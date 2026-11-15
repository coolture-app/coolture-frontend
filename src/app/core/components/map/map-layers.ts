import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { LayerComponent } from '@maplibre/ngx-maplibre-gl';

/** MapLibre's paint can't read CSS variables, so the tokens it needs are repeated here. */
const ACCENT = '#2563eb';
const TEXT = '#111827';

/** Typed as `mgl-layer`'s inputs, which are narrower than MapLibre's own specifications. */
type AnyLayout = NonNullable<ReturnType<LayerComponent['layout']>>;
type AnyPaint = NonNullable<ReturnType<LayerComponent['paint']>>;
type SymbolLayout = Extract<AnyLayout, { 'text-field'?: unknown }>;
type SymbolPaint = Extract<AnyPaint, { 'text-color'?: unknown }>;
type CirclePaint = Extract<AnyPaint, { 'circle-color'?: unknown }>;

/** The fonts OpenFreeMap's Liberty style serves glyphs for. */
const REGULAR = ['Noto Sans Regular'];
const BOLD = ['Noto Sans Bold'];

/** Pill backgrounds, by tone, and the lit one. */
const PILLS = {
  'pill-plain': { fill: '#ffffff', stroke: '#c7cbd1' },
  'pill-quiet': { fill: '#f3f4f6', stroke: '#dcdfe4' },
  'pill-pick': { fill: ACCENT, stroke: '#1d4ed8' },
  'pill-lit': { fill: TEXT, stroke: TEXT },
};

const PIXEL_RATIO = 2;
const PILL_HEIGHT = 26;

/**
 * Draws the pills once per map. Each is a rounded end, a 2 px middle that MapLibre stretches to the text's width,
 * and the other end.
 */
export function addPillImages(map: MapLibreMap): void {
  const height = PILL_HEIGHT * PIXEL_RATIO;
  const radius = height / 2;
  const width = height + 2 * PIXEL_RATIO;
  for (const [name, { fill, stroke }] of Object.entries(PILLS)) {
    if (map.hasImage(name)) {
      continue;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const line = PIXEL_RATIO;
    context.beginPath();
    context.roundRect(line / 2, line / 2, width - line, height - line, radius - line / 2);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = line;
    context.strokeStyle = stroke;
    context.stroke();
    map.addImage(name, context.getImageData(0, 0, width, height), {
      pixelRatio: PIXEL_RATIO,
      stretchX: [[radius, width - radius]],
    });
  }
}

const TONE_TEXT: ExpressionSpecification = [
  'match',
  ['get', 'tone'],
  'pick',
  '#ffffff',
  'quiet',
  '#6b7280',
  TEXT,
];

/** A post or a place: the pill with its date, drawn whatever it overlaps, so no event goes missing. */
export const PILL_LAYOUT: SymbolLayout = {
  'icon-image': ['concat', 'pill-', ['get', 'tone']],
  'icon-text-fit': 'width',
  'icon-text-fit-padding': [0, 10, 0, 10],
  'icon-allow-overlap': true,
  'text-allow-overlap': true,
  'icon-ignore-placement': true,
  'text-ignore-placement': true,
  'text-field': ['get', 'label'],
  'text-font': BOLD,
  'text-size': 12.5,
  'symbol-sort-key': ['get', 'sortKey'],
  'symbol-z-order': 'source',
};
export const PILL_PAINT: SymbolPaint = { 'text-color': TONE_TEXT };

/** The selected pin, over the others. */
export const LIT_LAYOUT: SymbolLayout = {
  ...PILL_LAYOUT,
  'icon-image': 'pill-lit',
  'text-size': 13.5,
};
export const LIT_PAINT: SymbolPaint = { 'text-color': '#ffffff' };

/** The title beside a pill when zoomed in. It's the only thing that gives way when pins crowd. */
export const TITLE_MIN_ZOOM = 14;
export const TITLE_LAYOUT: SymbolLayout = {
  'text-field': ['get', 'title'],
  'text-font': REGULAR,
  'text-size': 12,
  'text-anchor': 'top',
  'text-offset': [0, 1.25],
  'text-max-width': 10,
  'text-optional': true,
  'symbol-sort-key': ['get', 'sortKey'],
};
export const TITLE_PAINT: SymbolPaint = {
  'text-color': TEXT,
  'text-halo-color': '#ffffff',
  'text-halo-width': 1.5,
};

/** A cluster: an accent circle, bigger for more posts. */
export const CLUSTER_PAINT: CirclePaint = {
  'circle-color': ACCENT,
  'circle-radius': ['step', ['get', 'posts'], 16, 10, 20, 50, 25],
  'circle-stroke-color': '#ffffff',
  'circle-stroke-width': 2,
  'circle-opacity': 0.92,
};
export const CLUSTER_COUNT_LAYOUT: SymbolLayout = {
  'text-field': ['to-string', ['get', 'posts']],
  'text-font': BOLD,
  'text-size': 13,
  'text-allow-overlap': true,
};
export const CLUSTER_COUNT_PAINT: SymbolPaint = { 'text-color': '#ffffff' };

/** The user's own position, after "Moja lokalizacja". */
export const HERE_PAINT: CirclePaint = {
  'circle-color': ACCENT,
  'circle-radius': 7,
  'circle-stroke-color': '#ffffff',
  'circle-stroke-width': 3,
};
