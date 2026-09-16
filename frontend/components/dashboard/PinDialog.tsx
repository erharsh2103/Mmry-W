"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/lib/api";
import { useI18n } from "@/hooks/useI18n";
import { usePatient } from "@/hooks/usePatient";
import { useSpeech } from "@/hooks/useSpeech";
import ui from "@/components/ui/ui.module.css";
import styles from "./shell.module.css";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

/* The caregiver lock. The code is checked by the API, never compared in the browser. */
export function PinDialog({ onCancel }: { onCancel: () => void }) {
  const { t } = useI18n();
  const { say } = useSpeech();
  const { unlock } = usePatient();
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<"" | "wrong" | "locked" | "network">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    say("pinSpoken");
  }, [say]);

  const press = async (key: string) => {
    if (busy) return;
    if (key === "clear") return (setEntry(""), setError(""));
    if (key === "back") return (setEntry((e) => e.slice(0, -1)), setError(""));
    const next = (entry + key).slice(0, 4);
    setEntry(next);
    setError("");
    if (next.length < 4) return;
    setBusy(true);
    try {
      await unlock(next);
    } catch (err) {
      const e = err as ApiError;
      setError(e.status === 429 ? "locked" : e.isNetwork ? "network" : "wrong");
      setEntry("");
      if (e.status !== 429) say("pinWrong");
    } finally {
      setBusy(false);
    }
  };

  const message = error === "wrong" ? t("pinWrong") : error === "locked" ? t("pinLocked") : error === "network" ? t("errNetwork") : "";

  return (
    <div className={ui.overlay} role="dialog" aria-modal="true" aria-labelledby="pin-title">
      <div className={styles.pinCard}>
        <h2 id="pin-title" style={{ margin: 0, fontSize: "1.5em", fontWeight: 700 }}>
          {t("pinTitle")}
        </h2>
        <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>{t("pinSub")}</p>
        <div className={styles.pinDots} aria-label={`${entry.length} / 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={styles.pinDot} data-filled={entry.length > i} />
          ))}
        </div>
        {message && (
          <p role="alert" style={{ margin: "14px 0 0", textAlign: "center", color: "var(--red)", fontWeight: 700 }}>
            {message}
          </p>
        )}
        <div className={styles.pinKeys}>
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={styles.pinKey}
              disabled={busy}
              aria-label={k === "clear" ? "Clear" : k === "back" ? "Delete" : k}
              onClick={() => void press(k)}
            >
              {k === "clear" ? "✕" : k === "back" ? "⌫" : k}
            </button>
          ))}
        </div>
        <button type="button" className={ui.outline} style={{ marginTop: 16, borderRadius: 8, background: "var(--cream)" }} onClick={onCancel}>
          {t("pinCancel")}
        </button>
      </div>
    </div>
  );
}
