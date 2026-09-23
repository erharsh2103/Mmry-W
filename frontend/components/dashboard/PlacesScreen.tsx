"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { bearingLabel, cleanPhone, fixAge, fmtDist, placeDistance, sosText } from "@/lib/care/format";
import { isPlace, personText } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { LIVE, resourceKey, usePeople, useSafety } from "@/hooks/usePatientData";
import { setResource } from "@/hooks/useResource";
import { Icon } from "@/components/ui/Icon";
import { StateMessage } from "@/components/ui/StateMessage";
import { LocationMap } from "./LocationMap";
import type { AlertContact } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

export function PlacesScreen() {
  const patient = useCurrentPatient();
  const { t } = useI18n();
  const safety = useSafety(LIVE.safety);
  const people = usePeople();
  const [contacts, setContacts] = useState<AlertContact[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.safety.contacts(patient.id).then(({ contacts: next }) => setContacts(next.filter((contact) => contact.enabled))).catch(() => undefined);
  }, [patient.id]);

  if (!safety.data) return <StateMessage loading={safety.loading} error={safety.error} onRetry={safety.reload} />;
  const state = safety.data;
  const places = (people.data ?? []).filter(isPlace);
  const age = fixAge(state.lastFix?.at, t);
  const recipients = Array.from(new Set([cleanPhone(patient.caregiverPhone), ...contacts.map((contact) => cleanPhone(contact.phone))].filter(Boolean)));

  const toggleTracking = async () => {
    setBusy(true);
    try {
      setResource(resourceKey(patient.id, "safety"), await api.safety.updateZone(patient.id, { trackingEnabled: !state.zone.trackingEnabled }));
    } catch {
      setNote(t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const guideHome = () => {
    if (!state.zone.home || !state.lastFix) return;
    const origin = `${state.lastFix.lat},${state.lastFix.lon}`;
    const destination = `${state.zone.home.lat},${state.zone.home.lon}`;
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`, "_blank", "noopener,noreferrer");
  };

  const sendSos = async () => {
    setBusy(true);
    try {
      const next = await api.safety.sos(patient.id);
      setResource(resourceKey(patient.id, "safety"), next);
      if (!recipients.length) {
        setNote(t("locSosNoPhone"));
        return;
      }
      setNote(t("locSosSent"));
      window.location.href = `sms:${recipients.join(",")}?body=${encodeURIComponent(sosText(patient.displayName, next, t))}`;
    } catch {
      setNote(t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("locPlaces")}</h1>
      <p className={ui.pageSub}>{t("patientPlacesSub")}</p>

      <section className={ui.card} aria-labelledby="patient-location-title">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 id="patient-location-title" className={ui.cardTitle}>{t("patientLocation")}</h2>
          {state.zone.trackingEnabled && state.lastFix && age.minutes !== null && age.minutes < 5 && <span className={ui.badgeGreen}>{t("locLive")}</span>}
        </div>
        <p className={ui.muted} style={{ margin: "8px 0 0" }}>
          {state.lastFix ? `${state.lastFix.lat.toFixed(5)}, ${state.lastFix.lon.toFixed(5)} · ${t("locLastSeen", { t: age.label })}` : t("locNever")}
        </p>
        {state.lastFix && state.zone.home && (
          <p style={{ margin: "10px 0 0", fontWeight: 800, color: state.outside ? "var(--rust)" : "var(--green)" }}>
            {state.outside ? t("locOutside") : t("locInside")} · {fmtDist(state.distanceM)} {state.bearingDeg !== null ? `· ${bearingLabel(state.bearingDeg, t)}` : ""}
          </p>
        )}
        {state.zone.home && <LocationMap state={state} patientLabel={patient.displayName} />}
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {state.zone.home && state.lastFix && <button type="button" className={ui.navy} style={{ minHeight: 60, fontWeight: 800 }} onClick={guideHome}><Icon name="directions" size={28} />{t("locGuideHome")}</button>}
          <button type="button" className={state.zone.trackingEnabled ? ui.soft : ui.outline} style={{ minHeight: 56, fontWeight: 800 }} disabled={busy} onClick={() => void toggleTracking()}>
            <Icon name={state.zone.trackingEnabled ? "location_off" : "my_location"} size={26} />
            {t(state.zone.trackingEnabled ? "locStop" : "locStart")}
          </button>
        </div>
      </section>

      <section className={ui.card} style={{ marginTop: 18 }} aria-labelledby="saved-places-title">
        <h2 id="saved-places-title" className={ui.cardTitle}>{t("locPlaces")}</h2>
        <p className={ui.muted} style={{ margin: "8px 0 14px" }}>{t("locPlacesSub")}</p>
        {places.length ? <div className={ui.stack}>{places.map((place) => <div key={place.id} className={styles.place}><span style={{ fontSize: "2em" }} aria-hidden="true">{place.emoji}</span><span style={{ minWidth: 0 }}><strong>{personText(place, t).name}</strong><span style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>{placeDistance(place, state, t)}</span></span></div>)}</div> : <p className={ui.muted}>{t("locAddPlace")}</p>}
      </section>

      <section className={ui.card} style={{ marginTop: 18, borderColor: "var(--rust)" }} aria-labelledby="patient-sos-title">
        <h2 id="patient-sos-title" className={ui.cardTitle}>{t("sosTitle")}</h2>
        <p className={ui.muted} style={{ margin: "8px 0 14px" }}>{t("locSosEveryoneSub")}</p>
        <button type="button" className={ui.danger} style={{ minHeight: 64, fontWeight: 800, fontSize: "1.05em" }} disabled={busy} onClick={() => void sendSos()}><Icon name="e911_emergency" size={28} />{t("locSosEveryone")}</button>
        {note && <p className={styles.note} role="status">{note}</p>}
      </section>
    </div>
  );
}