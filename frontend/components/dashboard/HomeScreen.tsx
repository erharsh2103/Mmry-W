"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cleanPhone, fixAge, sosText } from "@/lib/care/format";
import { nowCard } from "@/lib/routine/now";
import { useClock } from "@/hooks/useClock";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { LIVE, resourceKey, useSafety, useSessions, useTasks } from "@/hooks/usePatientData";
import { setResource } from "@/hooks/useResource";
import { useSpeech } from "@/hooks/useSpeech";
import { Icon } from "@/components/ui/Icon";
import type { AlertContact } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

const TILES = [
  { key: "navDayShort", icon: "event_note", href: "/dashboard/day", primary: true },
  { key: "navTalk", icon: "mic", href: "/dashboard/talk" },
  { key: "navGames", icon: "extension", href: "/dashboard/activities" },
  { key: "navPpl", icon: "groups", href: "/dashboard/people" },
];

/* Opens a sms: or tel: link in the phone's own app. Nothing is sent by Mmry itself. */
function openExternal(url: string) {
  window.location.href = url;
}

let greetedThisVisit = false;

export function HomeScreen() {
  const router = useRouter();
  const patient = useCurrentPatient();
  const now = useClock();
  const { t, locale, translatorFor } = useI18n();
  const { say, speak, speechLang } = useSpeech();
  const tasks = useTasks(undefined, LIVE.routine);
  const sessions = useSessions(20);
  const safety = useSafety(LIVE.safety);
  const [sosOpen, setSosOpen] = useState(false);
  const [note, setNote] = useState("");
  const [contacts, setContacts] = useState<AlertContact[]>([]);
  const announced = useRef(false);

  const card = nowCard(tasks.data ?? [], sessions.data ?? [], t, translatorFor(speechLang), now);

  useEffect(() => {
    void api.safety.contacts(patient.id).then(({ contacts: next }) => setContacts(next.filter((contact) => contact.enabled))).catch(() => undefined);
  }, [patient.id]);

  // Say the current card once per visit, as the original app did on launch.
  useEffect(() => {
    if (announced.current || greetedThisVisit || !tasks.data || !sessions.data) return;
    announced.current = true;
    greetedThisVisit = true;
    const id = setTimeout(() => speak(card.spoken), 900);
    return () => clearTimeout(id);
  }, [tasks.data, sessions.data, card.spoken, speak]);

  const caregiver = patient.caregiverName || t("caregiver");
  const phone = cleanPhone(patient.caregiverPhone);
  const fix = safety.data?.lastFix;

  const openSos = () => {
    setSosOpen(true);
    say("sosSpoken");
  };

  const sendSms = async () => {
    try {
      const state = await api.safety.sos(patient.id);
      setResource(resourceKey(patient.id, "safety"), state);
    } catch {
      // The message still goes out from the phone even if the server is unreachable.
    }
    const recipients = Array.from(new Set([phone, ...contacts.map((contact) => cleanPhone(contact.phone))].filter(Boolean)));
    if (!recipients.length) return setNote(t("locSosNoPhone"));
    setNote(t("locSosSent"));
    openExternal(`sms:${recipients.join(",")}?body=${encodeURIComponent(sosText(patient.displayName, safety.data ?? null, t))}`);
  };

  const call = () => {
    if (!phone) return setNote(t("locSosNoPhone"));
    openExternal(`tel:${phone}`);
  };

  return (
    <div className={styles.home}>
      <h1 className={styles.greeting}>
        {t("greeting")}, {patient.displayName}.
      </h1>
      {!sosOpen && (
        <p className={styles.clock}>
          {now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })} ·{" "}
          {now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}

      {!sosOpen && (
        <button
          type="button"
          className={styles.nowCard}
          data-kind={card.kind}
          onClick={() => {
            speak(card.spoken);
            router.push(card.kind === "activity" ? "/dashboard/activities/memory-cards" : "/dashboard/day");
          }}
        >
          <span className={styles.nowTile}>
            {card.icon.length <= 2 ? <span aria-hidden="true">{card.icon}</span> : <Icon name={card.icon} size={32} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className={styles.nowEyebrow}>{card.eyebrow}</span>
            <span className={styles.nowTitle}>{card.title}</span>
          </span>
          <Icon name="chevron_right" size={34} />
        </button>
      )}

      {!sosOpen && (
        <section aria-label="Main actions" className={styles.homeTiles}>
          {TILES.map((tile) => (
            <button key={tile.key} type="button" className={styles.homeTile} data-primary={tile.primary ?? false} onClick={() => router.push(tile.href)}>
              <Icon name={tile.icon} size={28} />
              <span className={styles.homeTileLabel}>{t(tile.key)}</span>
            </button>
          ))}
        </section>
      )}

      {!sosOpen ? (
        <button type="button" className={styles.sosButton} onClick={openSos} aria-label={t("sosTitle")}>
          <Icon name="e911_emergency" size={30} />
          {t("sosHomeLabel")}
        </button>
      ) : (
        <div className={styles.sosSheet} role="region" aria-labelledby="sos-title">
          <p id="sos-title" className={styles.sosTitle}>
            {t("sosSheet")}
          </p>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontWeight: 600, fontSize: "0.95em" }}>{t("sosSheetSub", { name: caregiver })}</p>
          <p style={{ margin: "8px 0 0", color: "var(--ink)", fontWeight: 700, fontSize: "0.95em" }}>
            {fix ? `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)} · ${t("locLastSeen", { t: fixAge(fix.at, t).label })}` : t("locNever")}
          </p>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <button type="button" className={styles.sosCall} onClick={call}>
              <Icon name="call" size={26} />
              {t("locCall")}
            </button>
            <button type="button" className={ui.outline} style={{ minHeight: 60, fontWeight: 800, fontSize: "1.05em" }} onClick={() => void sendSms()}>
              <Icon name="sms" size={26} />
              {t("locSosEveryone")}
            </button>
            <button
              type="button"
              className={ui.outline}
              style={{ minHeight: 52, borderColor: "var(--line)", background: "var(--cream)", color: "var(--muted)" }}
              onClick={() => {
                setSosOpen(false);
                setNote("");
              }}
            >
              {t("sosClose")}
            </button>
          </div>
          {note && (
            <p className={styles.note} role="status">
              {note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
