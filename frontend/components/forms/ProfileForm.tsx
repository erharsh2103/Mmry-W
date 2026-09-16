"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ApiError } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { usePatient, useCurrentPatient } from "@/hooks/usePatient";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { MemoryVault } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import screens from "@/components/dashboard/screens.module.css";

type Saved = "" | "saving" | "saved" | "error";

function useSaveState() {
  const [state, setState] = useState<Saved>("");
  const [message, setMessage] = useState("");
  return { state, message, setState, setMessage };
}

export function ProfileForm() {
  const router = useRouter();
  const patient = useCurrentPatient();
  const { update, setPin, lock } = usePatient();
  const { t } = useI18n();

  const [name, setName] = useState(patient.displayName);
  const [age, setAge] = useState(patient.age ? String(patient.age) : "");
  const [caregiver, setCaregiver] = useState(patient.caregiverName ?? "");
  const [phone, setPhone] = useState(patient.caregiverPhone ?? "");
  const [pin, setPinValue] = useState("");
  const [vault, setVault] = useState<MemoryVault>(patient.vault);
  const details = useSaveState();
  const pinSave = useSaveState();
  const vaultSave = useSaveState();

  const failure = (err: unknown) => {
    const e = err as ApiError;
    return e.isNetwork ? t("errNetwork") : e.details?.[0]?.message ?? e.message ?? t("errGeneric");
  };

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return (details.setState("error"), details.setMessage(t("setupNeedName")));
    details.setState("saving");
    try {
      const ageNum = Number.parseInt(age, 10);
      await update({
        displayName: name.trim(),
        age: Number.isFinite(ageNum) && ageNum > 0 && ageNum <= 130 ? ageNum : null,
        caregiverName: caregiver.trim() || null,
        caregiverPhone: phone.trim() || null,
      });
      details.setState("saved");
    } catch (err) {
      details.setState("error");
      details.setMessage(failure(err));
    }
  };

  const savePin = async (value: string | null) => {
    pinSave.setState("saving");
    try {
      await setPin(value);
      setPinValue("");
      pinSave.setState("saved");
    } catch (err) {
      pinSave.setState("error");
      pinSave.setMessage((err as ApiError).status === 403 ? t("pfPinOwnerOnly") : failure(err));
    }
  };

  const saveVault = async (e: FormEvent) => {
    e.preventDefault();
    vaultSave.setState("saving");
    try {
      await update({ vault });
      vaultSave.setState("saved");
    } catch (err) {
      vaultSave.setState("error");
      vaultSave.setMessage(failure(err));
    }
  };

  const status = (s: ReturnType<typeof useSaveState>) =>
    s.state === "error" ? (
      <p className={ui.formError} role="alert">
        {s.message}
      </p>
    ) : s.state === "saved" ? (
      <p role="status" style={{ margin: 0, color: "var(--green)", fontWeight: 700 }}>
        {t("pfSaved")}
      </p>
    ) : null;

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("pfTitle")}</h1>
      <p className={ui.pageSub}>{t("pfSub")}</p>

      <div className={screens.formColumns}>
      <div>
      <form className={ui.card} style={{ marginTop: 22 }} onSubmit={saveDetails} noValidate>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{ width: 72, height: 72, flex: "none", borderRadius: 999, background: "var(--stone)", border: "2px solid var(--navy)", display: "grid", placeItems: "center", fontSize: "1.9em", fontWeight: 800 }}
            aria-hidden="true"
          >
            {(patient.displayName || "M").charAt(0).toUpperCase()}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "1.4em", fontWeight: 800, letterSpacing: "-0.02em" }}>{patient.displayName}</span>
            <span style={{ display: "block", color: "var(--muted)", fontWeight: 600 }}>
              {t("pfAge")} {patient.age ?? "—"}
            </span>
          </span>
        </div>
        <div className={ui.stack} style={{ marginTop: 18 }}>
          <Field label={t("setupName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          <Field label={t("pfAge")} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={3} />
          <Field label={t("pfCare")} value={caregiver} onChange={(e) => setCaregiver(e.target.value)} maxLength={80} />
          <Field label={t("pfPhone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={32} />
          {status(details)}
          <button type="submit" className={ui.pillButton} disabled={details.state === "saving"}>
            {details.state === "saving" ? t("pfSaving") : t("save")}
          </button>
        </div>
      </form>

      <section className={ui.card} style={{ marginTop: 18 }}>
        <h2 className={ui.cardTitle}>{t("pfPin")}</h2>
        <p className={ui.muted} style={{ margin: "8px 0 14px", fontWeight: 400, lineHeight: 1.5 }}>
          {t("pfPinNote")}
        </p>
        <div className={ui.stack}>
          <Field
            label={t("pfPin")}
            value={pin}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            type="password"
            autoComplete="off"
            hint={patient.access !== "owner" ? t("pfPinOwnerOnly") : undefined}
          />
          {status(pinSave)}
          <button type="button" className={ui.primary} disabled={pin.length !== 4 || pinSave.state === "saving"} onClick={() => void savePin(pin)}>
            <Icon name="lock" size={24} />
            {t("pfPinSet")}
          </button>
          {patient.hasPin && (
            <>
              <button type="button" className={ui.danger} disabled={pinSave.state === "saving"} onClick={() => void savePin(null)}>
                <Icon name="lock_open" size={24} />
                {t("pfPinClear")}
              </button>
              <button
                type="button"
                className={ui.outline}
                style={{ borderRadius: 8, background: "var(--cream)" }}
                onClick={() => {
                  lock();
                  router.replace("/dashboard");
                }}
              >
                <Icon name="lock" size={26} />
                {t("pfLock")}
              </button>
            </>
          )}
        </div>
      </section>

      </div>
      <form className={ui.card} style={{ marginTop: 22 }} onSubmit={saveVault} noValidate>
        <h2 className={ui.cardTitle}>{t("pfVault")}</h2>
        <p className={ui.muted} style={{ margin: "8px 0 14px" }}>
          {t("pfVaultNote")}
        </p>
        <div className={ui.stack}>
          <Field label={t("vaultHome")} value={vault.home} onChange={(e) => setVault({ ...vault, home: e.target.value })} maxLength={300} />
          <Field label={t("vaultDoctor")} value={vault.doctor} onChange={(e) => setVault({ ...vault, doctor: e.target.value })} maxLength={300} />
          <Field label={t("vaultEmergency")} value={vault.emergency} onChange={(e) => setVault({ ...vault, emergency: e.target.value })} maxLength={300} />
          <Field label={t("vaultMeds")} value={vault.medicines} onChange={(e) => setVault({ ...vault, medicines: e.target.value })} maxLength={300} />
          {status(vaultSave)}
          <button type="submit" className={ui.pillButton} disabled={vaultSave.state === "saving"}>
            {vaultSave.state === "saving" ? t("pfSaving") : t("save")}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
