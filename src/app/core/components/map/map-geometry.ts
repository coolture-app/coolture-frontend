import { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { GeoPoint } from '../../models/common/geo.model';
import { haversineMeters } from '../../services/location/location.service';
import { MapBounds } from '../../models/posts/map-bounds.model';

/** What "Szukaj w tym obszarze" hands over: the circle inside the view, touching its nearer edges. */
export interface MapArea {
  centre: GeoPoint;
  /** Whole km, at least 1. */
  radiusKm: number;
}

/** The circle around the rounded `centre` that touches the nearer of the view's `top` and `east` edges. */
export function areaInView(centre: GeoPoint, top: number, east: number): MapArea {
  const at = { latitude: round(centre.latitude), longitude: round(centre.longitude) };
  const toEdgeKm =
    Math.min(
      haversineMeters(at, { latitude: top, longitude: at.longitude }),
      haversineMeters(at, { latitude: at.latitude, longitude: east }),
    ) / 1000;
  return { centre: at, radiusKm: Math.max(1, Math.round(toEdgeKm)) };
}

/**
 * The map's start shows at least `count` pins: `enough` when the view has them, `wider` when fewer are loaded at all,
 * or else the points to fit, the centre and the `count` pins nearest it.
 */
export function startStep(
  view: Box,
  centre: GeoPoint,
  marks: readonly { coordinates: GeoPoint }[],
  count: number,
): 'enough' | 'wider' | GeoPoint[] {
  if (marks.filter((m) => inBox(view, m.coordinates)).length >= count) {
    return 'enough';
  }
  const closest = nearest(marks, centre, count);
  return closest.length < count ? 'wider' : [centre, ...closest.map((m) => m.coordinates)];
}

export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function toBox(bounds: {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}): Box {
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

/** The box grown by `views` of its own size on each side. */
export function padded({ west, south, east, north }: Box, views: number): Box {
  const width = (east - west) * views;
  const height = (north - south) * views;
  return { west: west - width, south: south - height, east: east + width, north: north + height };
}

export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  );
}

export function inBox(box: Box, { latitude, longitude }: GeoPoint): boolean {
  return (
    longitude >= box.west && longitude <= box.east && latitude >= box.south && latitude <= box.north
  );
}

/** The box, kept inside the world's limits. */
export function toMapBounds({ west, south, east, north }: Box): MapBounds {
  if (east - west >= 360) {
    west = -180;
    east = 180;
  } else {
    west = clamp(west, 180);
    east = clamp(east, 180);
  }
  return {
    leftUpper: { latitude: clamp(north, 90), longitude: west },
    rightBottom: { latitude: clamp(south, 90), longitude: east },
  };
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/** About 110 m: enough for a radius's centre, and a short link. */
export function round(coordinate: number): number {
  return Math.round(coordinate * 1000) / 1000;
}

const EARTH_RADIUS_KM = 6371;

/** Wound the other way from `circle`'s ring, so MapLibre reads the circle as a hole in it. */
const WORLD = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

/** A circle on the map as a 64-sided polygon, close enough at city scale. */
export function circle(latitude: number, longitude: number, radiusKm: number): Feature<Polygon> {
  const angular = radiusKm / EARTH_RADIUS_KM;
  const lat = (latitude * Math.PI) / 180;
  const lng = (longitude * Math.PI) / 180;
  const ring = Array.from({ length: 65 }, (_, i) => {
    const bearing = (i / 64) * 2 * Math.PI;
    const pointLat = Math.asin(
      Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const pointLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat),
      );
    return [(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** The world with the circle cut out. */
export function outside(area: Feature<Polygon>): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [WORLD, ...area.geometry.coordinates] },
  };
}

/** The smallest [[west, south], [east, north]] around the points. */
export function boundsOf(points: readonly GeoPoint[]): [[number, number], [number, number]] {
  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function ringPoints(area: Feature<Polygon>): GeoPoint[] {
  return area.geometry.coordinates[0].map(([longitude, latitude]) => ({ latitude, longitude }));
}

export function nearest<T extends { coordinates: GeoPoint }>(
  items: readonly T[],
  centre: GeoPoint,
  count: number,
): T[] {
  return [...items]
    .sort((a, b) => haversineMeters(centre, a.coordinates) - haversineMeters(centre, b.coordinates))
    .slice(0, count);
}

export function pointData(at: GeoPoint | null): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: at
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [at.longitude, at.latitude] },
          },
        ]
      : [],
  };
}

/** Screen pixels, relative to the map's top left corner. */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How far a selected pin has to move on screen for it, and a card of `cardHeight` above or below it, to fit in `view`
 * with `margin` to spare. Zero when they fit already. MapLibre puts the card on whichever side has room, so the pin
 * moves only towards the nearer side that would. A card too tall for either side leaves the pin at the top.
 */
export function fitPin(
  pin: { x: number; y: number },
  view: ScreenBox,
  cardHeight: number,
  margin: number,
  gap: number,
): { dx: number; dy: number } {
  const card = cardHeight > 0 ? cardHeight + gap : 0;
  const top = view.top + margin;
  const bottom = view.bottom - margin;
  const ranges = [
    [top, bottom - card],
    [top + card, bottom],
  ].filter(([low, high]) => low <= high);
  const targets = ranges.length
    ? ranges.map(([low, high]) => Math.min(high, Math.max(low, pin.y)))
    : [top];
  const y = targets.reduce((best, t) => (Math.abs(t - pin.y) < Math.abs(best - pin.y) ? t : best));
  const x = Math.min(view.right - margin, Math.max(view.left + margin, pin.x));
  return { dx: x - pin.x, dy: y - pin.y };
}
