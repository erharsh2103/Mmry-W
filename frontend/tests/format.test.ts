import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alertText, cleanPhone, fmtDist, radarLayout, sosText } from "@/lib/care/format";
import { localDay, nowCard } from "@/lib/routine/now";
import { translate } from "@/lib/i18n/translate";
import type { SafetyState, Task } from "@/types/api";

const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);

const state = (over: Partial<SafetyState> = {}): SafetyState => ({
  zone: { home: { lat: 26.1445, lon: 91.7362 }, radiusM: 500, armed: true, trackingEnabled: true },
  lastFix: { lat: 26.1515, lon: 91.744, accuracyM: 15, at: new Date().toISOString() },
  distanceM: 1101,
  bearingDeg: 45,
  outside: true,
  events: [],
  ...over,
});

const task = (over: Partial<Task>): Task => ({
  id: "t", labelKey: "task_med_am", label: null, timeKey: "t8am", hour: 8, icon: "medication", sortOrder: 1, done: false, ...over,
});

describe("caregiver formatting", () => {
  it("formats distances the way the original app did", () => {
    assert.equal(fmtDist(499.6), "500 m");
    assert.equal(fmtDist(1000), "1 km");
    assert.equal(fmtDist(1101), "1.1 km");
    assert.equal(fmtDist(12400), "12 km");
    assert.equal(fmtDist(null), "—");
  });

  it("places an outside patient north-east of centre and inside the radar", () => {
    const r = radarLayout(state());
    assert.ok(r.showDot);
    assert.ok(r.dotLeft > 50 && r.dotTop < 50, "north-east");
    assert.ok(r.dotLeft <= 96 && r.dotTop >= 4, "clamped inside");
  });

  it("builds an SOS message with a geo: link only when a position exists", () => {
    assert.match(sosText("Aai", state(), t), /geo:26\.151500,91\.744000/);
    assert.doesNotMatch(sosText("Aai", state({ lastFix: null }), t), /geo:/);
  });

  it("keeps only digits and + in phone numbers", () => {
    assert.equal(cleanPhone("+91 98000-00045"), "+919800000045");
  });

  it("turns alert ids into sentences with formatted numbers", () => {
    const a = alertText({ id: "geo_outside", tone: "warn", data: { distanceM: 1101, radiusM: 500, fixAt: new Date().toISOString() } }, t);
    assert.ok(a.text.includes("1.1 km"));
    assert.ok(a.text.includes("500 m"));
  });
});

describe("now card", () => {
  it("shows a task that is due", () => {
    const at = new Date(2026, 0, 5, 8, 10);
    const card = nowCard([task({})], [], t, t, at);
    assert.equal(card.kind, "task");
  });

  it("suggests an activity in the daytime when nothing is due", () => {
    const at = new Date(2026, 0, 5, 14, 0);
    const card = nowCard([task({ done: true })], [], t, t, at);
    assert.equal(card.kind, "activity");
  });

  it("uses the local calendar day", () => {
    assert.equal(localDay(new Date(2026, 2, 9, 23, 59)), "2026-03-09");
  });
});
