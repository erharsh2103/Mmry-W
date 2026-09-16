"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { bearingLabel, cleanPhone, fixAge, fmtDist, placeDistance, radarLayout, sosText } from "@/lib/care/format";
import { isPlace, personText } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { LIVE, resourceKey, usePeople, useSafety } from "@/hooks/usePatientData";
import { setResource, useStoredValue } from "@/hooks/useResource";
import type { LocationError } from "@/hooks/useLocationTracking";
import { Icon } from "@/components/ui/Icon";
import { LiveStamp } from "@/components/ui/LiveStamp";
import { StateMessage } from "@/components/ui/StateMessage";
import type { SafetyState } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

const RADII = [200, 500, 1000, 2000] as const;
const ERROR_KEY: Record<Exclude<LocationError, "">, string> = { denied: "locDenied", unsupported: "locUnsupported", unavailable: "locUnavailable" };

export function SafetyPanel() {
  const patient = useCurrentPatient();
  const { t } = useI18n();
  const safety = useSafety(LIVE.safety);
  const people = usePeople();
  const geoError = useStoredValue<LocationError>(resourceKey(patient.id, "geoError")) ?? "";
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!safety.data) return <StateMessage loading={safety.loading} error={safety.error} onRetry={safety.reload} />;
  const s = safety.data;

  const act = async (fn: () => Promise<SafetyState>) => {
    setBusy(true);
    try {
      setResource(resourceKey(patient.id, "safety"), await fn());
    } catch {
      setNote(t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const hasHome = !!s.zone.home;
  const hasFix = !!s.lastFix;
  const age = fixAge(s.lastFix?.at, t);
  const live = s.zone.trackingEnabled && hasFix && age.minutes !== null && age.minutes < 5;
  const zoneState = !hasHome || !hasFix ? "unknown" : s.outside ? "outside" : "inside";
  const radar = radarLayout(s);
  const phone = cleanPhone(patient.caregiverPhone);
  const careName = patient.caregiverName || t("caregiver");
  const places = (people.data ?? []).filter(isPlace);

  const sendSms = async () => {
    await act(() => api.safety.sos(patient.id));
    if (!phone) return setNote(t("locSosNoPhone"));
    setNote(t("locSosSent"));
    window.location.href = `sms:${phone}?body=${encodeURIComponent(sosText(patient.displayName, s, t))}`;
  };

  const copy = async () => {
    const text = sosText(patient.displayName, s, t);
    try {
      await navigator.clipboard.writeText(text);
      setNote(t("locCopied"));
    } catch {
      setNote(text);
    }
  };

  return (
    <section className={ui.card} style={{ marginTop: 18 }} aria-labelledby="loc-title">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <h2 id="loc-title" className={ui.cardTitle}>
          {t("locTitle")}
        </h2>
        {live && <span className={ui.badgeGreen}>{t("locLive")}</span>}
      </div>
      <LiveStamp updatedAt={safety.updatedAt} loading={safety.loading} />
      <p className={ui.muted} style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
        {t("locSub")}
      </p>

      <div className={styles.zone} data-state={zoneState}>
        <span className={styles.zoneDot}>
          <Icon name={zoneState === "unknown" ? "help" : zoneState === "outside" ? "running_with_errors" : "check_circle"} size={28} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: "1.1em", fontWeight: 800 }}>
            {t(!hasHome ? "locNoHome" : !hasFix ? "locWaiting" : s.outside ? "locOutside" : "locInside")}
          </span>
          <span style={{ display: "block", color: "var(--ink)", fontWeight: 600, marginTop: 2 }}>
            {!hasHome
              ? t("locNoHomeSub")
              : !hasFix
                ? t("locUnavailable")
                : s.outside
                  ? t("locOutsideSub", {
                      d: fmtDist(s.distanceM),
                      o: fmtDist((s.distanceM ?? 0) - s.zone.radiusM),
                      r: fmtDist(s.zone.radiusM),
                      b: bearingLabel(s.bearingDeg ?? 0, t),
                    })
                  : t("locInsideSub", { d: fmtDist(s.distanceM), r: fmtDist(s.zone.radiusM) })}
          </span>
          <span style={{ display: "block", color: "var(--muted)", fontWeight: 600, marginTop: 4, fontSize: "0.92em" }}>
            {hasFix ? `${t("locLastSeen", { t: age.label })}${s.lastFix!.accuracyM > 0 ? ` · ${t("locAccuracy", { n: s.lastFix!.accuracyM })}` : ""}` : t("locNever")}
          </span>
        </span>
      </div>

      {hasHome && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className={styles.radar} role="img" aria-label={hasFix ? t("locInsideSub", { d: fmtDist(s.distanceM), r: fmtDist(s.zone.radiusM) }) : t("locWaiting")}>
            <span className={styles.ring} style={{ width: "66%", height: "66%" }} />
            <span className={styles.ring} style={{ width: "33%", height: "33%" }} />
            <span className={styles.safeRing} data-outside={s.outside} style={{ width: `${radar.zonePct}%`, height: `${radar.zonePct}%` }} />
            <span className={styles.compass} style={{ left: "50%", top: 6, transform: "translateX(-50%)" }}>N</span>
            <span className={styles.compass} style={{ left: "50%", bottom: 6, transform: "translateX(-50%)" }}>S</span>
            <span className={styles.compass} style={{ top: "50%", right: 6, transform: "translateY(-50%)" }}>E</span>
            <span className={styles.compass} style={{ top: "50%", left: 6, transform: "translateY(-50%)" }}>W</span>
            <span className={styles.homeDot} />
            {radar.showDot && <span className={styles.patientDot} data-outside={s.outside} style={{ left: `${radar.dotLeft.toFixed(1)}%`, top: `${radar.dotTop.toFixed(1)}%` }} />}
          </div>
          <p className={ui.muted} style={{ margin: "10px 0 0", textAlign: "center", fontSize: "0.9em" }}>
            {t("locMapNote")}
          </p>
        </div>
      )}

      <button
        type="button"
        className={s.zone.trackingEnabled ? ui.soft : ui.navy}
        style={{ marginTop: 18, minHeight: 60, fontWeight: 800, fontSize: "1.05em" }}
        disabled={busy}
        onClick={() => void act(() => api.safety.updateZone(patient.id, { trackingEnabled: !s.zone.trackingEnabled }))}
      >
        <Icon name={s.zone.trackingEnabled ? "location_off" : "my_location"} size={26} />
        {t(s.zone.trackingEnabled ? "locStop" : "locStart")}
      </button>
      {geoError && s.zone.trackingEnabled && (
        <p role="alert" style={{ margin: "10px 0 0", fontWeight: 700, fontSize: "0.92em", color: "var(--rust)" }}>
          {t(ERROR_KEY[geoError])}
        </p>
      )}

      <p className={styles.sectionLabel} style={{ marginTop: 20 }}>
        {t("locZone")}
      </p>
      <p className={ui.muted} style={{ margin: "0 0 10px", fontSize: "0.92em" }}>
        {t("locZoneSub")}
      </p>
      <div className={styles.radii} role="radiogroup" aria-label={t("locZone")}>
        {RADII.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={s.zone.radiusM === r}
            className={styles.radius}
            disabled={busy}
            onClick={() => void act(() => api.safety.updateZone(patient.id, { radiusM: r }))}
          >
            {fmtDist(r)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={ui.outline}
        style={{ marginTop: 12 }}
        disabled={busy || !hasFix}
        onClick={() => void act(() => api.safety.setHome(patient.id, { kind: "lastFix" }))}
      >
        <Icon name="home_pin" size={24} />
        {t("locSetHome")}
      </button>
      <p className={ui.muted} style={{ margin: "8px 0 0", fontSize: "0.9em" }}>
        {s.zone.home ? t("locHomeAt", { ll: `${s.zone.home.lat.toFixed(5)}, ${s.zone.home.lon.toFixed(5)}` }) : t("locNoHome")}
      </p>
      <button
        type="button"
        className={s.zone.armed ? ui.soft : ui.outline}
        style={{ marginTop: 12, ...(s.zone.armed ? { background: "var(--green-tint)" } : { borderColor: "var(--line)", color: "var(--muted)" }) }}
        disabled={busy}
        onClick={() => void act(() => api.safety.updateZone(patient.id, { armed: !s.zone.armed }))}
      >
        <Icon name={s.zone.armed ? "notifications_active" : "notifications_off"} size={24} />
        {t(s.zone.armed ? "locArmed" : "locDisarmed")}
      </button>

      <p className={styles.sectionLabel}>{t("locShare")}</p>
      <p className={ui.muted} style={{ margin: "0 0 12px", fontSize: "0.92em" }}>
        {t("locShareSub", { name: careName })}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" className={ui.navy} style={{ minHeight: 60, fontWeight: 800, fontSize: "1.05em" }} onClick={() => void sendSms()}>
          <Icon name="sms" size={26} />
          {t("locSms")}
        </button>
        <button
          type="button"
          className={ui.soft}
          style={{ minHeight: 60, fontWeight: 800, fontSize: "1.05em" }}
          onClick={() => (phone ? (window.location.href = `tel:${phone}`) : setNote(t("locSosNoPhone")))}
        >
          <Icon name="call" size={26} />
          {t("locCall")}
        </button>
        <button type="button" className={ui.outline} onClick={() => void copy()}>
          <Icon name="content_copy" size={24} />
          {t("locCopy")}
        </button>
      </div>
      {note && (
        <p className={styles.note} role="status">
          {note}
        </p>
      )}

      <p className={styles.sectionLabel}>{t("locPlaces")}</p>
      <p className={ui.muted} style={{ margin: "0 0 12px", fontSize: "0.92em" }}>
        {t("locPlacesSub")}
      </p>
      <div className={ui.stack}>
        {places.map((place) => (
          <div key={place.id} className={styles.place}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.9em", lineHeight: 1 }} aria-hidden="true">
                {place.emoji}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 800 }}>{personText(place, t).name}</span>
                <span style={{ display: "block", color: "var(--muted)", fontWeight: 600, fontSize: "0.92em" }}>{placeDistance(place, s, t)}</span>
              </span>
            </div>
            <div className={styles.placeActions}>
              <button
                type="button"
                className={styles.smallBtn}
                disabled={busy || !hasFix}
                onClick={async () => {
                  const { person } = await api.people.pinHere(patient.id, place.id);
                  people.mutate((people.data ?? []).map((p) => (p.id === person.id ? person : p)));
                }}
              >
                {t("locSaveHere")}
              </button>
              {place.location && (
                <>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    style={{ borderColor: "var(--green)", background: "var(--green-soft)", color: "var(--green)" }}
                    disabled={busy}
                    onClick={() => void act(() => api.safety.setHome(patient.id, { kind: "place", personId: place.id }))}
                  >
                    {t("locUseAsHome")}
                  </button>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    style={{ borderColor: "var(--rust)", background: "var(--cream)", color: "var(--rust)" }}
                    onClick={async () => {
                      const { person } = await api.people.clearPin(patient.id, place.id);
                      people.mutate((people.data ?? []).map((p) => (p.id === person.id ? person : p)));
                    }}
                  >
                    {t("locClearPin")}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {!places.length && (
        <p className={ui.muted} style={{ margin: "4px 0 0", fontSize: "0.92em" }}>
          {t("locAddPlace")}
        </p>
      )}

      <p className={styles.sectionLabel}>{t("locLog")}</p>
      {!s.events.length && (
        <p className={ui.muted} style={{ margin: 0, fontSize: "0.92em" }}>
          {t("locLogEmpty")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {s.events.slice(0, 8).map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "2px solid var(--line-soft)", paddingTop: 10 }}>
            <Icon
              name={e.kind === "sos" ? "e911_emergency" : e.kind === "out" ? "running_with_errors" : "check_circle"}
              size={26}
              color={e.kind === "in" ? "var(--green)" : "var(--rust)"}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: "0.98em" }}>{t(e.kind === "sos" ? "locSos" : e.kind === "out" ? "locOut" : "locIn")}</span>
              <span style={{ display: "block", color: "var(--muted)", fontWeight: 600, fontSize: "0.9em" }}>
                {new Date(e.at).toLocaleString()}
                {typeof e.distanceM === "number" ? ` · ${t("locLogRow", { d: fmtDist(e.distanceM) })}` : ""}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
