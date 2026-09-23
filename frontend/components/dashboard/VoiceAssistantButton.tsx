"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { localDay } from "@/lib/routine/now";
import { useI18n } from "@/hooks/useI18n";
import { usePatient } from "@/hooks/usePatient";
import { resourceKey } from "@/hooks/usePatientData";
import { invalidate } from "@/hooks/useResource";
import { useSpeech, type ListenError } from "@/hooks/useSpeech";
import { Icon } from "@/components/ui/Icon";
import { currentTimeReply, isTimeQuestion } from "@/lib/assistant/time";
import styles from "./shell.module.css";

type LastAnswer = { heard: string; reply: string } | null;

export function VoiceAssistantButton() {
  const router = useRouter();
  const { patient } = usePatient();
  const { t } = useI18n();
  const { listen, stopListening, speak, say, micState, recognitionSupported } = useSpeech();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<LastAnswer>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!patient?.onboardingDone) return null;

  const active = busy || micState !== "idle";
  const label = micState === "listening" ? t("vListening") : micState === "waiting" ? t("vMicWaiting") : busy ? t("authWorking") : t("vTapToSpeak");
  const shown = last ?? { heard: "", reply: "" };

  const fail = (kind: ListenError | "api", heard = "") => {
    const reply =
      kind === "no-speech"
        ? t("vAgain")
        : kind === "no-mic"
          ? t("vNoMic")
          : kind === "unsupported"
            ? t("vCauseNoSR")
            : kind === "api"
              ? t("vCauseServer")
              : t("vNoListen");
    setLast({ heard, reply });
    setPanelOpen(true);
    if (kind === "no-speech") say("vAgain");
    else speak(reply);
  };

  const ask = async (text: string, speechConfidence: number | null) => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (isTimeQuestion(clean)) {
      const reply = currentTimeReply(patient.language, t);
      setLast({ heard: clean, reply });
      setPanelOpen(true);
      speak(reply);
      return;
    }
    setBusy(true);
    setPanelOpen(true);
    const day = localDay();
    try {
      const answer = await api.assistant.ask(patient.id, {
        text: clean,
        lang: patient.language,
        source: speechConfidence === null ? "chip" : "speech",
        speechConfidence,
        day,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setLast({ heard: clean, reply: answer.reply });
      speak(answer.reply);
      // A reminder the patient just spoke into being: the routine and the home
      // screen's "right now" card must show it without a reload.
      if (answer.created?.kind === "reminder") {
        invalidate(resourceKey(patient.id, `tasks:${day}`));
        invalidate(resourceKey(patient.id, `insights:${day}`));
      }
      if (answer.action?.type === "navigate") setTimeout(() => router.push(answer.action!.route), 650);
    } catch (err) {
      fail((err as ApiError).isNetwork ? "api" : "failed", clean);
    } finally {
      setBusy(false);
    }
  };

  const onClick = async () => {
    if (busy) return;
    if (micState !== "idle") {
      stopListening();
      return;
    }
    if (!recognitionSupported) {
      setPanelOpen((open) => !open);
      if (!panelOpen) setLast({ heard: "", reply: t("vCauseNoSR") });
      return;
    }

    setLast(null);
    let heard;
    try {
      heard = await listen();
    } catch (err) {
      const kind = err as ListenError;
      if (kind !== "aborted") fail(kind);
      return;
    }
    if (!heard.text.trim()) return fail("no-speech");
    await ask(heard.text, heard.confidence);
  };

  return (
    <div className={styles.voiceDock}>
      {(panelOpen || last) && (
        <div className={styles.voicePanel}>
          <div role="status" aria-live="polite">
          {shown.heard && <p className={styles.voiceHeard}>{shown.heard}</p>}
          {shown.reply && <p className={styles.voiceReply}>{shown.reply}</p>}
          </div>
          <form
            className={styles.voiceForm}
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft;
              setDraft("");
              void ask(text, null);
            }}
          >
            <input
              className={styles.voiceInput}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a question"
              aria-label="Type a question"
              disabled={busy}
            />
            <button type="submit" className={styles.voiceSend} disabled={busy || !draft.trim()} aria-label="Send">
              <Icon name="send" size={22} />
            </button>
          </form>
        </div>
      )}
      <button type="button" className={styles.voiceButton} data-active={active} data-state={micState} aria-label={label} aria-pressed={active} onClick={() => void onClick()}>
        <Icon name={active ? "graphic_eq" : "mic"} size={30} />
      </button>
    </div>
  );
}
