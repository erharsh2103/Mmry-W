/*
 * Presentation of caregiver data: distances, compass directions, fix age,
 * the radar layout, the SOS message, and sentences for insights and alerts.
 * The API returns numbers and ids; all wording happens here, per language.
 */
import type { Translator } from "@/lib/i18n/translate";
import type { Insights, Person, SafetyState } from "@/types/api";

const COMPASS = ["locN", "locNE", "locE", "locSE", "locS", "locSW", "locW", "locNW"];

export function fmtDist(m: number | null | undefined): string {
  if (typeof m !== "number" || !(m >= 0)) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km % 1 === 0 ? String(km) : km.toFixed(km < 10 ? 1 : 0)} km`;
}

export const bearingLabel = (deg: number, t: Translator) => t(COMPASS[Math.round(deg / 45) % 8]!);

const RAD = Math.PI / 180;
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearingDeg(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const y = Math.sin((to.lon - from.lon) * RAD) * Math.cos(to.lat * RAD);
  const x = Math.cos(from.lat * RAD) * Math.sin(to.lat * RAD) - Math.sin(from.lat * RAD) * Math.cos(to.lat * RAD) * Math.cos((to.lon - from.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export function fixAge(at: string | null | undefined, t: Translator, now = Date.now()): { minutes: number | null; label: string } {
  if (!at) return { minutes: null, label: t("locNever") };
  const minutes = Math.floor((now - Date.parse(at)) / 60_000);
  if (minutes < 1) return { minutes, label: t("locJustNow") };
  if (minutes < 60) return { minutes, label: t("locMinsAgo", { n: minutes }) };
  return { minutes, label: t("locHoursAgo", { n: Math.floor(minutes / 60) }) };
}

/*
 * Radar: home at the centre, the patient placed by bearing and distance,
 * clamped to the edge. The view scales so the safe ring and the patient fit.
 */
export function radarLayout(state: SafetyState) {
  const radius = state.zone.radiusM;
  const viewM = Math.max(radius * 1.7, (state.distanceM ?? 0) * 1.25, 60);
  const pctPerM = 50 / viewM;
  let left = 50;
  let top = 50;
  if (state.distanceM !== null) {
    const rad = (state.bearingDeg ?? 0) * RAD;
    const r = Math.min(state.distanceM * pctPerM, 46);
    left = 50 + Math.sin(rad) * r;
    top = 50 - Math.cos(rad) * r;
  }
  return { zonePct: Math.min(96, radius * pctPerM * 2), dotLeft: left, dotTop: top, showDot: state.distanceM !== null };
}

/* The caregiver's message. A geo: URI opens any map app; the https line is tappable on most phones. */
export function sosText(name: string, state: SafetyState | null, t: Translator): string {
  const fix = state?.lastFix;
  const where = fix ? `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)} (±${fix.accuracyM} m)` : t("locNoFix");
  const when = fix ? new Date(fix.at).toLocaleString() : "";
  const body = t("locSmsBody", { name, where, when });
  if (!fix) return body;
  const ll = `${fix.lat.toFixed(6)},${fix.lon.toFixed(6)}`;
  return `${body}\ngeo:${ll}\nhttps://www.openstreetmap.org/?mlat=${fix.lat.toFixed(6)}&mlon=${fix.lon.toFixed(6)}#map=17/${ll.replace(",", "/")}`;
}

export const cleanPhone = (raw: string | null | undefined) => String(raw ?? "").replace(/[^0-9+]/g, "");

export function placeDistance(person: Person, state: SafetyState | null, t: Translator): string {
  if (!person.location) return t("locPlaceNoPin");
  if (!state?.lastFix) return t("locWaiting");
  const d = distanceM(state.lastFix, person.location);
  return t("locPlaceAway", { d: fmtDist(d), b: bearingLabel(bearingDeg(state.lastFix, person.location), t) });
}

/* "3 activities and one mind check" style note while the data is still thin. */
export function thinNote(needs: Insights["needs"], t: Translator): string {
  const parts: string[] = [];
  if (needs.activities) parts.push(t(needs.activities === 1 ? "cNeedAct1" : "cNeedActN", { n: needs.activities }));
  if (needs.mindCheck) parts.push(t("cNeedCheck"));
  return parts.length ? t("cNeedsPre", { list: parts.join(t("cAnd")) }) : "";
}

export const activityLabel = (n: number, t: Translator) => t(n === 1 ? "cAct1" : "cActN", { n });

const INSIGHT: Record<string, { icon: string; key: string }> = {
  thin: { icon: "eco", key: "iThin" },
  provisional: { icon: "eco", key: "cProvisionalNote" },
  visual_strong: { icon: "psychology", key: "iVisual" },
  focus_strong: { icon: "psychology", key: "iFocus" },
  routine_low: { icon: "medication", key: "iRem" },
  drop: { icon: "warning", key: "iDrop" },
  up: { icon: "trending_up", key: "iUp" },
  slow: { icon: "schedule", key: "iSlow" },
  steady: { icon: "check_circle", key: "iSteady" },
};

export function insightText(ins: Insights["insights"][number], insights: Insights, t: Translator): { icon: string; text: string } {
  const meta = INSIGHT[ins.id] ?? { icon: "info", key: ins.id };
  if (ins.id === "provisional") {
    return { icon: meta.icon, text: t(meta.key, { n: activityLabel(insights.activityCount, t), need: thinNote(insights.needs, t) }) };
  }
  return { icon: meta.icon, text: t(meta.key, { n: ins.data?.pct ?? "" }) };
}

const ALERT: Record<string, { icon: string; title: string; text: string }> = {
  geo_outside: { icon: "running_with_errors", title: "alGeo", text: "alGeoText" },
  geo_stale: { icon: "location_off", title: "alGeoStale", text: "alGeoStaleText" },
  perf_drop: { icon: "warning", title: "alPerf", text: "alPerfText" },
  evening_med: { icon: "medication", title: "alMed", text: "alMedText" },
  idle: { icon: "psychology", title: "alEngage", text: "alEngageText" },
  no_baseline: { icon: "assignment", title: "alBase", text: "alBaseText" },
  inconsistent: { icon: "help", title: "alIncon", text: "alInconText" },
  none: { icon: "check_circle", title: "alNone", text: "alNoneText" },
};

export function alertText(alert: Insights["alerts"][number], t: Translator): { icon: string; title: string; text: string } {
  const meta = ALERT[alert.id] ?? { icon: "info", title: alert.id, text: "" };
  const d = alert.data ?? {};
  const vars: Record<string, string | number> = {
    n: alert.id === "idle" ? d.days ?? "" : d.pct ?? "",
    d: fmtDist(typeof d.distanceM === "number" ? d.distanceM : null),
    r: fmtDist(typeof d.radiusM === "number" ? d.radiusM : null),
    t: fixAge(typeof d.fixAt === "string" ? d.fixAt : null, t).label,
  };
  return { icon: meta.icon, title: t(meta.title), text: t(meta.text, vars) };
}
