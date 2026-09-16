"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { languageLabel } from "@/lib/i18n/languages";
import { genderOf } from "@/lib/speech/voices";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { usePatient, useCurrentPatient } from "@/hooks/usePatient";
import { clearResources } from "@/hooks/useResource";
import { useSpeech } from "@/hooks/useSpeech";
import { Icon } from "@/components/ui/Icon";
import { LanguagePicker } from "./LanguagePicker";
import type { PatientUpdate, VoicePref } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import screens from "@/components/dashboard/screens.module.css";

const VOICES: { id: VoicePref; icon: string; key: string }[] = [
  { id: "auto", icon: "auto_awesome", key: "pfVoAuto" },
  { id: "female", icon: "face_3", key: "pfVoWoman" },
  { id: "male", icon: "face_6", key: "pfVoMan" },
];
const SPEEDS = [
  { id: 0.75 as const, key: "pfSlow" },
  { id: 0.9 as const, key: "pfNormal" },
  { id: 1.1 as const, key: "pfFast" },
];
const SCALES = [0.9, 1, 1.15, 1.3, 1.4];

const choice = (on: boolean) => ({
  minHeight: 72,
  border: `3px solid ${on ? "var(--green)" : "var(--navy)"}`,
  background: on ? "var(--green-soft)" : "var(--cream-2)",
  color: "var(--navy)",
  borderRadius: 12,
  padding: "12px 8px",
  fontWeight: 700,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
});

export function SettingsForm() {
  const router = useRouter();
  const patient = useCurrentPatient();
  const { patients, select, update } = usePatient();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { resolved, speechLang, voices, say, cancel } = useSpeech();
  const [error, setError] = useState("");

  const save = async (changes: PatientUpdate, sample = true) => {
    setError("");
    try {
      await update(changes);
      if (sample) setTimeout(() => say("pfSample"), 160);
    } catch {
      setError(t("errGeneric"));
    }
  };

  const langLabel = languageLabel(patient.language);
  const who = (g: string) => t(g === "female" ? "pfVoWoman" : g === "male" ? "pfVoMan" : "pfVoAuto").toLowerCase();
  const voiceStatus = !voices.length || !resolved.voice
    ? t("pfVoNone")
    : resolved.status === "native"
      ? t("pfVoNativeWho", { who: who(genderOf(resolved.voice)), lang: langLabel })
      : speechLang !== patient.language
        ? t("pfVoOther", { voice: resolved.voice.name, tag: resolved.tag, lang: langLabel, other: languageLabel(speechLang) })
        : t("pfVoSub", { voice: resolved.voice.name, tag: resolved.tag, lang: langLabel });

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("stTitle")}</h1>
      <p className={ui.pageSub}>{t("stSub")}</p>
      {error && (
        <p className={ui.formError} role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <section className={ui.card} style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 className={ui.cardTitle}>{t("pfLangVoice")}</h2>
          <button
            type="button"
            className={screens.voicePill}
            aria-pressed={patient.voiceOn}
            onClick={() => {
              if (patient.voiceOn) cancel();
              void save({ voiceOn: !patient.voiceOn }, false);
            }}
          >
            <Icon name="volume_up" size={26} />
            {t(patient.voiceOn ? "vOn" : "vOff")}
          </button>
        </div>
        <p className={ui.muted} style={{ margin: "8px 0 14px", fontWeight: 400, lineHeight: 1.5 }}>
          {t("pfLangNote")}
        </p>
        <LanguagePicker value={patient.language} onChange={(code) => code !== patient.language && void save({ language: code })} />

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start", background: "var(--cream-2)", border: "2px dashed var(--muted-2)", borderRadius: 8, padding: "12px 14px" }}>
          <Icon name="record_voice_over" size={22} color="var(--muted)" />
          <span style={{ fontSize: "0.92em", color: "var(--muted)", lineHeight: 1.45 }}>{voiceStatus}</span>
        </div>

        <p style={{ margin: "18px 0 10px", fontWeight: 700 }}>{t("pfVoicePick")}</p>
        <div role="radiogroup" aria-label={t("pfVoicePick")} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {VOICES.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={patient.voicePref === v.id} style={{ ...choice(patient.voicePref === v.id), minHeight: 92 }} onClick={() => void save({ voicePref: v.id })}>
              <Icon name={v.icon} size={30} />
              <span style={{ fontSize: "0.98em", textAlign: "center", lineHeight: 1.2 }}>{t(v.key)}</span>
            </button>
          ))}
        </div>

        <p style={{ margin: "20px 0 10px", fontWeight: 700 }}>{t("pfSpeed")}</p>
        <div role="radiogroup" aria-label={t("pfSpeed")} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {SPEEDS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={Math.abs(patient.voiceRate - s.id) < 0.03} style={choice(Math.abs(patient.voiceRate - s.id) < 0.03)} onClick={() => void save({ voiceRate: s.id })}>
              {t(s.key)}
            </button>
          ))}
        </div>

        <button type="button" className={ui.outline} style={{ marginTop: 20, minHeight: 60, borderRadius: 8, fontSize: "1.08em" }} onClick={() => say("pfSample")}>
          <Icon name="play_circle" size={28} />
          {t("pfTest")}
        </button>

        <p style={{ margin: "22px 0 10px", fontWeight: 700 }}>{t("stTextSize")}</p>
        <div role="radiogroup" aria-label={t("stTextSize")} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
          {SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              role="radio"
              aria-checked={Math.abs(patient.fontScale - scale) < 0.01}
              style={{ ...choice(Math.abs(patient.fontScale - scale) < 0.01), minHeight: 60, fontSize: `${scale}em` }}
              onClick={() => void save({ fontScale: scale }, false)}
            >
              A
            </button>
          ))}
        </div>
      </section>

      <section className={ui.card} style={{ marginTop: 18 }}>
        <h2 className={ui.cardTitle}>{t("stAccount")}</h2>
        {user && (
          <p className={ui.muted} style={{ margin: "8px 0 14px", overflowWrap: "anywhere" }}>
            {t("stSignedInAs", { email: user.email })}
          </p>
        )}
        {patients.length > 1 && (
          <div className={ui.stack} style={{ marginBottom: 14 }}>
            {patients.map((p) => (
              <button key={p.id} type="button" className={p.id === patient.id ? ui.soft : ui.outline} onClick={() => select(p.id)} aria-pressed={p.id === patient.id}>
                {p.displayName}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={ui.danger}
          onClick={async () => {
            await logout();
            clearResources();
            router.replace("/login");
          }}
        >
          <Icon name="logout" size={24} />
          {t("authSignOut")}
        </button>
      </section>
    </div>
  );
}
