/**
 * Navigation Service
 *
 * Provides road-based routing, turn-by-turn navigation helpers, and a small
 * in-memory route cache used by StationMap.tsx.
 *
 * Routing is powered by the public OSRM demo server, which returns real
 * road-following geometry that matches the OpenStreetMap tiles the map uses.
 * Distances are in meters and durations are in seconds throughout.
 */

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  /** Index into the route polyline where this step starts. */
  polylineIndex: number;
}

export interface RouteData {
  /** Ordered list of [lat, lng] points describing the route geometry. */
  polyline: [number, number][];
  /** Total route distance in meters. */
  distance: number;
  /** Total route duration in seconds. */
  duration: number;
  /** Turn-by-turn steps for the route. */
  steps: RouteStep[];
}

export interface NavigationState {
  currentStepIndex: number;
  remainingDistance: number;
  remainingTime: number;
  currentInstruction: string;
  isOnRoute: boolean;
  offRouteDistance: number;
}

interface GetRouteOptions {
  /** Number of alternative routes to request in addition to the primary. */
  alternatives?: number;
  /** OSRM profile: driving | cycling | walking. Defaults to driving. */
  profile?: 'driving' | 'cycling' | 'walking';
}

const OSRM_BASE_URL = 'https://router.project-osrm.org';

const routeCache = new Map<string, { route: RouteData; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function cacheRoute(key: string, route: RouteData): void {
  routeCache.set(key, { route, timestamp: Date.now() });
}

export function getCachedRoute(key: string): RouteData | null {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return entry.route;
}

/**
 * Fetch one or more road-following routes between two coordinates.
 * Returns at least one route on success; throws on network / API failure.
 */
export async function getRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  options: GetRouteOptions = {}
): Promise<RouteData[]> {
  const profile = options.profile ?? 'driving';
  const alternatives = options.alternatives ?? 0;

  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: alternatives > 0 ? 'true' : 'false',
  });

  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coords}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Routing request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error(data.message || 'No route found');
  }

  return data.routes.map((r: any) => parseOsrmRoute(r));
}

function parseOsrmRoute(osrmRoute: any): RouteData {
  const coordinates: [number, number][] = (osrmRoute.geometry?.coordinates || []).map(
    ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
  );

  const steps: RouteStep[] = [];
  let cumulativePoints = 0;

  for (const leg of osrmRoute.legs || []) {
    for (const step of leg.steps || []) {
      steps.push({
        instruction: describeManeuver(step),
        distance: step.distance ?? 0,
        duration: step.duration ?? 0,
        polylineIndex: cumulativePoints,
      });
      const stepCoords = step.geometry?.coordinates?.length ?? 0;
      cumulativePoints += Math.max(stepCoords - 1, 0);
    }
  }

  if (steps.length === 0) {
    steps.push({
      instruction: 'Head towards destination',
      distance: osrmRoute.distance ?? 0,
      duration: osrmRoute.duration ?? 0,
      polylineIndex: 0,
    });
  }

  return {
    polyline: coordinates,
    distance: osrmRoute.distance ?? 0,
    duration: osrmRoute.duration ?? 0,
    steps,
  };
}

function describeManeuver(step: any): string {
  const maneuver = step.maneuver || {};
  const type: string = maneuver.type || 'continue';
  const modifier: string | undefined = maneuver.modifier;
  const road: string = step.name || '';

  const direction = modifier ? capitalize(modifier) : '';

  let action: string;
  switch (type) {
    case 'depart':
      action = 'Head out';
      break;
    case 'arrive':
      return 'Arrive at destination';
    case 'turn':
      action = direction ? `Turn ${direction.toLowerCase()}` : 'Turn';
      break;
    case 'merge':
      action = direction ? `Merge ${direction.toLowerCase()}` : 'Merge';
      break;
    case 'on ramp':
      action = 'Take the ramp';
      break;
    case 'off ramp':
      action = 'Take the exit';
      break;
    case 'fork':
      action = direction ? `Keep ${direction.toLowerCase()}` : 'Keep straight at the fork';
      break;
    case 'roundabout':
    case 'rotary':
      action = 'Enter the roundabout';
      break;
    case 'exit roundabout':
    case 'exit rotary':
      action = 'Exit the roundabout';
      break;
    case 'new name':
    case 'continue':
    default:
      action = direction ? `Continue ${direction.toLowerCase()}` : 'Continue straight';
      break;
  }

  return road ? `${action} onto ${road}` : action;
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points in meters. */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Find the nearest point on a polyline to (lat, lng).
 * Returns the perpendicular distance in meters plus the segment index and
 * the projected point coordinates.
 */
export function findNearestPointOnRoute(
  lat: number,
  lng: number,
  polyline: [number, number][]
): { distance: number; index: number; point: [number, number] } {
  if (polyline.length === 0) {
    return { distance: Infinity, index: 0, point: [lat, lng] };
  }
  if (polyline.length === 1) {
    return {
      distance: haversineDistance(lat, lng, polyline[0][0], polyline[0][1]),
      index: 0,
      point: polyline[0],
    };
  }

  let bestDistance = Infinity;
  let bestIndex = 0;
  let bestPoint: [number, number] = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const projected = projectPointOnSegment(lat, lng, a, b);
    const d = haversineDistance(lat, lng, projected[0], projected[1]);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
      bestPoint = projected;
    }
  }

  return { distance: bestDistance, index: bestIndex, point: bestPoint };
}

/**
 * Projection of a point onto a polyline segment using an equirectangular
 * approximation. Accurate enough for short street-level segments.
 */
function projectPointOnSegment(
  lat: number,
  lng: number,
  a: [number, number],
  b: [number, number]
): [number, number] {
  const refLat = toRadians((a[0] + b[0]) / 2);
  const scaleX = Math.cos(refLat);

  const ax = a[1] * scaleX;
  const ay = a[0];
  const bx = b[1] * scaleX;
  const by = b[0];
  const px = lng * scaleX;
  const py = lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return [a[0], a[1]];

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  return [ay + t * dy, (ax + t * dx) / scaleX];
}

/**
 * Returns true when the user is within `thresholdMeters` of the route polyline.
 */
export function isOnRoute(
  lat: number,
  lng: number,
  polyline: [number, number][],
  thresholdMeters: number = 50
): boolean {
  if (polyline.length === 0) return false;
  const { distance } = findNearestPointOnRoute(lat, lng, polyline);
  return distance <= thresholdMeters;
}

/**
 * Given the user's current position and a route, returns the remaining
 * distance/time and which step the user is currently executing.
 */
export function calculateRemainingRoute(
  lat: number,
  lng: number,
  route: RouteData
): { currentStepIndex: number; remainingDistance: number; remainingTime: number } {
  if (route.polyline.length === 0) {
    return { currentStepIndex: 0, remainingDistance: 0, remainingTime: 0 };
  }

  const { index: nearestSegmentIndex, point } = findNearestPointOnRoute(lat, lng, route.polyline);

  let remainingDistance = haversineDistance(
    point[0],
    point[1],
    route.polyline[nearestSegmentIndex + 1]?.[0] ?? point[0],
    route.polyline[nearestSegmentIndex + 1]?.[1] ?? point[1]
  );

  for (let i = nearestSegmentIndex + 1; i < route.polyline.length - 1; i++) {
    remainingDistance += haversineDistance(
      route.polyline[i][0],
      route.polyline[i][1],
      route.polyline[i + 1][0],
      route.polyline[i + 1][1]
    );
  }

  const totalDistance = route.distance || 1;
  const fractionRemaining = Math.max(0, Math.min(1, remainingDistance / totalDistance));
  const remainingTime = route.duration * fractionRemaining;

  let currentStepIndex = 0;
  for (let i = 0; i < route.steps.length; i++) {
    if (route.steps[i].polylineIndex <= nearestSegmentIndex) {
      currentStepIndex = i;
    } else {
      break;
    }
  }

  return { currentStepIndex, remainingDistance, remainingTime };
}

/** Human-readable distance string (e.g. "850 m", "2.3 km"). */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Human-readable duration string (e.g. "45 sec", "12 min", "1 hr 5 min"). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes === 0 ? `${hours} hr` : `${hours} hr ${remMinutes} min`;
}
