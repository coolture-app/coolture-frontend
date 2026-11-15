import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { LayerComponent } from '@maplibre/ngx-maplibre-gl';

/** MapLibre's paint can't read CSS variables, so the tokens it needs are repeated here. */
const ACCENT = '#2563eb';
const TEXT = '#111827';
const BORDER = '#c7cbd1';

/** Typed as `mgl-layer`'s inputs, which are narrower than MapLibre's own specifications. */
type AnyLayout = NonNullable<ReturnType<LayerComponent['layout']>>;
type AnyPaint = NonNullable<ReturnType<LayerComponent['paint']>>;
type SymbolLayout = Extract<AnyLayout, { 'text-field'?: unknown }>;
type SymbolPaint = Extract<AnyPaint, { 'text-color'?: unknown }>;
type CirclePaint = Extract<AnyPaint, { 'circle-color'?: unknown }>;

/** The fonts OpenFreeMap's Liberty style serves glyphs for. They have no star, so the star is drawn. */
const REGULAR = ['Noto Sans Regular'];
const BOLD = ['Noto Sans Bold'];

/** The clusters' count is of posts, not of places. */
export const CLUSTER_POSTS: Record<string, ExpressionSpecification> = {
  posts: ['+', ['get', 'count']],
  picks: ['+', ['case', ['==', ['get', 'tone'], 'pick'], 1, 0]],
};

const PIXEL_RATIO = 2;
const PILL_HEIGHT = 26;
/** How far a pick's star sticks out above and right of its pill, in CSS pixels, as it does on a cluster. */
const BADGE_OVERHANG = 7;
const BADGE_SIZE = 16;

interface Pill {
  fill: string;
  stroke: string;
  /** In CSS pixels. */
  line: number;
  badge?: boolean;
}

const PILLS: Record<string, Pill> = {
  'pill-plain': { fill: '#ffffff', stroke: BORDER, line: 1 },
  'pill-pick': { fill: '#ffffff', stroke: ACCENT, line: 2, badge: true },
  'pill-lit': { fill: TEXT, stroke: TEXT, line: 1 },
  'pill-lit-pick': { fill: TEXT, stroke: TEXT, line: 1, badge: true },
};

/**
 * Draws the pills and the stars once per map. A pill stretches in its 2 px middle, across and down, to fit its text;
 * the rounded ends keep their size. A pick's image has room above and right of its pill for the star, which overlaps
 * the pill's corner, and `content` keeps the text on the pill rather than on that room.
 */
export function addPillImages(map: MapLibreMap): void {
  const r = PIXEL_RATIO;
  const radius = (PILL_HEIGHT / 2) * r;
  const body = 2 * radius + 2 * r;
  for (const [name, pill] of Object.entries(PILLS)) {
    if (map.hasImage(name)) {
      continue;
    }
    const extra = pill.badge ? BADGE_OVERHANG * r : 0;
    const context = canvas(body + extra, body + extra);
    if (!context) {
      return;
    }
    const line = pill.line * r;
    context.beginPath();
    context.roundRect(line / 2, extra + line / 2, body - line, body - line, radius - line / 2);
    context.fillStyle = pill.fill;
    context.fill();
    context.lineWidth = line;
    context.strokeStyle = pill.stroke;
    context.stroke();
    if (pill.badge) {
      badge(context, body - 2 * r, extra + 2 * r, (BADGE_SIZE / 2) * r);
    }
    map.addImage(name, context.getImageData(0, 0, body + extra, body + extra), {
      pixelRatio: r,
      stretchX: [[radius, radius + 2 * r]],
      stretchY: [[extra + radius, extra + radius + 2 * r]],
      content: [0, extra, body, extra + body],
    });
  }
  if (!map.hasImage('star-badge')) {
    const size = BADGE_SIZE * r;
    const context = canvas(size, size);
    if (context) {
      badge(context, size / 2, size / 2, size / 2);
      map.addImage('star-badge', context.getImageData(0, 0, size, size), { pixelRatio: r });
    }
  }
}

/** The pick's star: white on an accent circle with a white edge, the same on pills, clusters and the legend. */
function badge(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const r = PIXEL_RATIO;
  context.beginPath();
  context.arc(x, y, radius - r, 0, 2 * Math.PI);
  context.fillStyle = ACCENT;
  context.fill();
  context.lineWidth = 1.5 * r;
  context.strokeStyle = '#ffffff';
  context.stroke();
  star(context, x, y, radius * 0.55, '#ffffff');
}

function canvas(width: number, height: number): CanvasRenderingContext2D | null {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element.getContext('2d');
}

function star(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  fill: string,
): void {
  const inner = outer * 0.45;
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const length = i % 2 === 0 ? outer : inner;
    context.lineTo(x + length * Math.cos(angle), y + length * Math.sin(angle) + outer * 0.08);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

const IS_PICK: ExpressionSpecification = ['==', ['get', 'tone'], 'pick'];

/** A post or a place: the pill with its date, drawn whatever it overlaps, so no event goes missing. */
export const PILL_LAYOUT: SymbolLayout = {
  'icon-image': ['case', IS_PICK, 'pill-pick', 'pill-plain'],
  'icon-text-fit': 'both',
  'icon-text-fit-padding': [5, 10, 5, 10],
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
export const PILL_PAINT: SymbolPaint = { 'text-color': TEXT };

/** The selected pin, over the others. */
export const LIT_LAYOUT: SymbolLayout = {
  ...PILL_LAYOUT,
  'icon-image': ['case', IS_PICK, 'pill-lit-pick', 'pill-lit'],
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

const HAS_PICKS: ExpressionSpecification = ['>', ['get', 'picks'], 0];
const CLUSTER_RADIUS: ExpressionSpecification = ['step', ['get', 'posts'], 16, 10, 20, 50, 25];

/**
 * A cluster: white with its count, like the pins, so only picks stand out. An accent ring and a star mark one that
 * holds a pick.
 */
export const CLUSTER_PAINT: CirclePaint = {
  'circle-color': '#ffffff',
  'circle-radius': CLUSTER_RADIUS,
  'circle-stroke-color': ['case', HAS_PICKS, ACCENT, BORDER],
  'circle-stroke-width': ['case', HAS_PICKS, 3, 1.5],
};
export const CLUSTER_COUNT_LAYOUT: SymbolLayout = {
  'text-field': ['to-string', ['get', 'posts']],
  'text-font': BOLD,
  'text-size': 13,
  'text-allow-overlap': true,
};
export const CLUSTER_COUNT_PAINT: SymbolPaint = { 'text-color': TEXT };

/** The star on a cluster's top right edge, whatever its size. */
export const CLUSTER_STAR_LAYOUT: SymbolLayout = {
  'icon-image': 'star-badge',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'icon-offset': [
    'step',
    ['get', 'posts'],
    ['literal', [12, -12]],
    10,
    ['literal', [15, -15]],
    50,
    ['literal', [18, -18]],
  ],
};

/** The user's own position, after "Moja lokalizacja". */
export const HERE_PAINT: CirclePaint = {
  'circle-color': ACCENT,
  'circle-radius': 7,
  'circle-stroke-color': '#ffffff',
  'circle-stroke-width': 3,
};
