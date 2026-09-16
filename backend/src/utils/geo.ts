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

/*
 * Hysteresis keeps a patient sitting on the boundary from generating a stream
 * of alerts: leaving needs radius + grace, coming back needs radius - grace.
 * Grace tracks the fix's own reported accuracy, so a poor GPS lock can never
 * invent a breach.
 */
export function isOutside(distance: number, radius: number, accuracy: number, wasOutside: boolean): boolean {
  const grace = Math.min(Math.max(accuracy || 0, 25), 150);
  return wasOutside ? distance > Math.max(0, radius - grace) : distance > radius + grace;
}
