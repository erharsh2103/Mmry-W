"use client";

import { useState, type FormEvent } from "react";
import { api, type ApiError } from "@/lib/api";
import { EMOJIS } from "@/lib/games/data";
import { personText } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { usePeople } from "@/hooks/usePatientData";
import { useSpeech } from "@/hooks/useSpeech";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { StateMessage } from "@/components/ui/StateMessage";
import type { MemoryVault } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

const VAULT: { key: keyof MemoryVault; icon: string; label: string }[] = [
  { key: "home", icon: "home", label: "vaultHome" },
  { key: "doctor", icon: "stethoscope", label: "vaultDoctor" },
  { key: "emergency", icon: "call", label: "vaultEmergency" },
  { key: "medicines", icon: "medication", label: "vaultMeds" },
];

const BLANK = { name: "", relation: "", note: "", emoji: "👩", isPlace: false };

export function PeopleScreen() {
  const patient = useCurrentPatient();
  const { t, translatorFor } = useI18n();
  const { speak, speechLang } = useSpeech();
  const people = usePeople();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async (id: string) => {
    const before = people.data ?? [];
    people.mutate(before.filter((p) => p.id !== id));
    try {
      await api.people.remove(patient.id, id);
    } catch {
      people.mutate(before);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t("setupNeedName"));
    setBusy(true);
    setError("");
    try {
      const { person } = await api.people.create(patient.id, {
        name: form.name.trim(),
        relation: form.relation.trim() || null,
        note: form.note.trim() || null,
        emoji: form.emoji,
        isPlace: form.isPlace,
      });
      people.mutate([...(people.data ?? []), person]);
      setForm(BLANK);
      setOpen(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.isNetwork ? t("errNetwork") : apiErr.details?.[0]?.message ?? t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("people")}</h1>
      <p className={ui.pageSub}>{t("peopleSub")}</p>

      {!people.data ? (
        <StateMessage loading={people.loading} error={people.error} onRetry={people.reload} />
      ) : (
        <div className={styles.cardGrid}>
          {people.data.map((person) => {
            const text = personText(person, t);
            return (
              <article key={person.id} className={styles.personCard}>
                <div className={styles.personFace} aria-hidden="true">
                  {person.emoji}
                </div>
                <div>
                  <h2 className={styles.personName}>{text.name}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: "1.05em", color: "var(--muted)" }}>{text.relation}</p>
                  {text.note && <p style={{ margin: "10px 0 0", color: "var(--ink)", lineHeight: 1.6, textWrap: "pretty" }}>{text.note}</p>}
                </div>
                <button
                  type="button"
                  className={ui.primary}
                  style={{ borderRadius: 8, fontSize: "1.1em", padding: "16px 20px" }}
                  onClick={() => {
                    const said = personText(person, translatorFor(speechLang));
                    speak(translatorFor(speechLang)("vWho", { name: said.name, relation: said.relation, note: said.note }));
                  }}
                >
                  <Icon name="volume_up" size={28} />
                  {t("pplWho")}
                </button>
                <button type="button" className={ui.danger} style={{ borderRadius: 8, borderColor: "var(--red)", color: "var(--red)" }} onClick={() => void remove(person.id)}>
                  <Icon name="delete" size={26} />
                  {t("remove")}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0, fontSize: "1.35em", fontWeight: 800, letterSpacing: "-0.02em" }}>{t("vaultTitle")}</h2>
        <p className={ui.pageSub}>{t("vaultSub")}</p>
        <div className={styles.cardGrid} style={{ marginTop: 14, gap: 14 }}>
          {VAULT.map((item) => (
            <div key={item.key} className={styles.vaultItem}>
              <span className={styles.vaultIcon}>
                <Icon name={item.icon} size={32} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 800, fontSize: "1.05em" }}>{t(item.label)}</span>
                <span style={{ display: "block", marginTop: 4, color: patient.vault[item.key] ? "var(--ink)" : "var(--muted)", fontWeight: 600 }}>
                  {patient.vault[item.key] || t("vaultEmpty")}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {open ? (
        <form className={ui.card} style={{ marginTop: 20 }} onSubmit={save} noValidate>
          <h2 style={{ margin: "0 0 14px", fontSize: "1.2em", fontWeight: 800 }}>{t("addPerson")}</h2>
          <div className={styles.emojiRow} role="radiogroup" aria-label={t("addPerson")}>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="radio"
                aria-checked={form.emoji === emoji}
                className={styles.emojiChoice}
                onClick={() => setForm({ ...form, emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className={ui.stack} style={{ marginTop: 16 }}>
            <Field label={t("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
            <Field label={t("relation")} value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} maxLength={80} />
            <Field label={t("note")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} />
          </div>
          <button
            type="button"
            role="checkbox"
            aria-checked={form.isPlace}
            className={styles.toggleRow}
            style={{ marginTop: 14 }}
            onClick={() => setForm({ ...form, isPlace: !form.isPlace, emoji: !form.isPlace ? "🏡" : form.emoji })}
          >
            <Icon name={form.isPlace ? "check_box" : "check_box_outline_blank"} size={26} />
            {t("pfPlaceToggle")}
          </button>
          {error && (
            <p className={ui.formError} role="alert" style={{ marginTop: 14 }}>
              {error}
            </p>
          )}
          <button type="submit" className={ui.pillButton} style={{ marginTop: 18 }} disabled={busy}>
            {busy ? t("authWorking") : t("save")}
          </button>
        </form>
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setOpen(true)}>
          ＋ {t("addPerson")}
        </button>
      )}
    </div>
  );
}
