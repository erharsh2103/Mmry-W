/*
 * Geofence maths, ported unchanged from the original app.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

/* Great-circle distance in metres (haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* Initial bearing from `from` to `to`, 0-360 degrees clockwise from north. */
export function bearingDeg(from: LatLon, to: LatLon): number {
  const y = Math.sin((to.lon - from.lon) * RAD) * Math.cos(to.lat * RAD);
  const x =
    Math.cos(from.lat * RAD) * Math.sin(to.lat * RAD) -
    Math.sin(from.lat * RAD) * Math.cos(to.lat * RAD) * Math.cos((to.lon - from.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/* The configured radius is the boundary. GPS accuracy is reported separately
 * and must not silently move the safe-zone edge shown on the map. */
export function isOutside(distance: number, radius: number, _accuracy: number, _wasOutside: boolean): boolean {
  return distance > radius;
}
