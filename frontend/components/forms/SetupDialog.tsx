"use client";

import { useState, type FormEvent } from "react";
import type { ApiError } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { usePatient } from "@/hooks/usePatient";
import { useSpeech } from "@/hooks/useSpeech";
import { Field } from "@/components/ui/Field";
import { LanguagePicker } from "./LanguagePicker";
import ui from "@/components/ui/ui.module.css";

/*
 * First-run setup: shown until the patient's profile is complete. Creates the
 * patient if this account has none yet, then saves the details.
 */
export function SetupDialog({ onLanguage }: { onLanguage: (code: string) => void }) {
  const { t, lang } = useI18n();
  const { say } = useSpeech();
  const { patient, create, update, setPin } = usePatient();
  const [name, setName] = useState(patient?.displayName ?? "");
  const [age, setAge] = useState(patient?.age ? String(patient.age) : "");
  const [caregiver, setCaregiver] = useState(patient?.caregiverName ?? "");
  const [phone, setPhone] = useState(patient?.caregiverPhone ?? "");
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t("setupNeedName"));
    setBusy(true);
    setError("");
    try {
      const target = patient ?? (await create(name.trim(), lang));
      const ageNum = Number.parseInt(age, 10);
      await update({
        displayName: name.trim(),
        language: lang,
        age: Number.isFinite(ageNum) && ageNum > 0 && ageNum <= 130 ? ageNum : null,
        caregiverName: caregiver.trim() || null,
        caregiverPhone: phone.trim() || null,
        onboardingDone: true,
      }, target.id);
      if (pin.length === 4) await setPin(pin, target.id);
      say("setupSpoken", { name: name.trim() });
    } catch (err) {
      const e = err as ApiError;
      setError(e.isNetwork ? t("errNetwork") : e.details?.[0]?.message ?? t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ui.overlay} style={{ zIndex: 60 }} role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <form className={ui.dialog} onSubmit={submit} noValidate>
        <h2 id="setup-title" style={{ margin: 0, fontSize: "1.9em", lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 800 }}>
          {t("setupTitle")}
        </h2>
        <p className={ui.pageSub}>{t("setupSub")}</p>
        <p style={{ margin: "20px 0 4px", fontWeight: 700 }}>{t("setupLang")}</p>
        <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: "0.95em", lineHeight: 1.5 }}>{t("setupLangNote")}</p>
        <LanguagePicker
          value={lang}
          onChange={(code) => {
            onLanguage(code);
            setTimeout(() => say("pfSample"), 140);
          }}
        />
        <div className={ui.stack} style={{ marginTop: 20, gap: 14 }}>
          <Field label={t("setupName")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={80} required />
          <Field label={t("setupAge")} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={3} />
          <Field label={t("setupCare")} value={caregiver} onChange={(e) => setCaregiver(e.target.value)} maxLength={80} />
          <Field
            label={t("setupPin")}
            value={pin}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            type="password"
            autoComplete="off"
          />
          <Field label={t("setupPhone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={32} />
        </div>
        {error && (
          <p className={ui.formError} role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}
        <button type="submit" className={ui.pillButton} style={{ marginTop: 22, padding: 20 }} disabled={busy}>
          {busy ? t("authWorking") : t("setupStart")}
        </button>
      </form>
    </div>
  );
}
