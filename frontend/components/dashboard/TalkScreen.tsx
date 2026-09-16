"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { CHIPS, CONVO, INTENT_ROUTE, replyFor, type ConvoNodeId, type ConvoOption } from "@/lib/assistant/conversation";
import { personText } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { usePatient } from "@/hooks/usePatient";
import { usePeople, useTasks } from "@/hooks/usePatientData";
import { useSpeech, type ListenError } from "@/hooks/useSpeech";
import { Icon } from "@/components/ui/Icon";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";
import type { IntentId } from "@/types/api";

interface Exchange {
  heard: string;
  reply: string;
  confirm: string;
  source: "model" | "rule" | null;
}

const EMPTY: Exchange = { heard: "", reply: "", confirm: "", source: null };

/*
 * Speak or tap. The browser recognises the words; the backend (and its
 * scikit-learn classifier) decides what was asked; the reply is composed here
 * from the patient's own routine and people.
 */
export function TalkScreen() {
  const router = useRouter();
  const { patient, update } = usePatient();
  const { t, translatorFor } = useI18n();
  const { say, speak, cancel, listen, listening, voiceOn, speechLang } = useSpeech();
  const tasks = useTasks();
  const people = usePeople();
  const [node, setNode] = useState<ConvoNodeId>("start");
  const [exchange, setExchange] = useState<Exchange>(EMPTY);
  const [busy, setBusy] = useState(false);

  if (!patient) return null;
  const spoken = translatorFor(speechLang);
  const texts = (people.data ?? []).map((p) => personText(p, t));
  const spokenTexts = (people.data ?? []).map((p) => personText(p, spoken));

  const answer = (intent: IntentId, heard: string, extra: Partial<Exchange> = {}) => {
    const reply = replyFor(intent, heard, tasks.data ?? [], texts, t);
    setExchange({ heard, reply, confirm: "", source: null, ...extra });
    speak(replyFor(intent, heard, tasks.data ?? [], spokenTexts, spoken));
    const route = INTENT_ROUTE[intent];
    if (route) setTimeout(() => router.push(route), 1400);
  };

  const ask = (next: ConvoNodeId) => {
    setNode(next);
    say(CONVO[next].askKey, { name: patient.displayName });
  };

  const pickOption = (opt: ConvoOption) => {
    if (opt.replyKey) {
      setExchange({ heard: t(opt.labelKey), reply: t(opt.replyKey), confirm: "", source: null });
      say(opt.replyKey);
    }
    if (opt.act) return answer(opt.act, t(opt.labelKey));
    if (opt.next) setTimeout(() => ask(opt.next!), opt.replyKey ? 900 : 0);
  };

  const onMic = async () => {
    if (listening || busy) return;
    setExchange(EMPTY);
    let heard;
    try {
      heard = await listen();
    } catch (err) {
      const kind = err as ListenError;
      const reply = kind === "no-speech" ? t("vAgain") : kind === "no-mic" ? t("vNoMic") : t("vNoListen");
      const confirm = kind === "unsupported" ? t("vCauseNoSR") : kind === "failed" ? t("vCauseBrowser", { kind: "network" }) : "";
      setExchange({ heard: "", reply, confirm, source: null });
      if (kind === "no-speech") say("vAgain");
      return;
    }
    if (heard.confidence < 0.6) {
      setExchange({ heard: heard.text, reply: t("vAgain"), confirm: "", source: null });
      return say("vAgain");
    }
    setBusy(true);
    try {
      const outcome = await api.assistant.intent(patient.id, {
        text: heard.text,
        lang: patient.language,
        source: "speech",
        speechConfidence: heard.confidence,
      });
      answer(outcome.intent, heard.text, {
        source: outcome.source,
        confirm: heard.confidence < 0.85 ? t("vConfirm", { text: heard.text }) : "",
      });
    } catch (err) {
      setExchange({ heard: heard.text, reply: t("vNoListen"), confirm: (err as ApiError).isNetwork ? t("vCauseServer") : t("errGeneric"), source: null });
    } finally {
      setBusy(false);
    }
  };

  const convo = CONVO[node];

  return (
    <div className={ui.screen}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: "1 1 240px" }}>
          <h1 className={ui.pageTitle}>{t("navSaathi")}</h1>
          <p className={ui.pageSub}>{t("saathiSub")}</p>
        </div>
        <button
          type="button"
          className={styles.voicePill}
          aria-pressed={voiceOn}
          onClick={() => {
            if (voiceOn) cancel();
            void update({ voiceOn: !voiceOn });
          }}
        >
          <Icon name="volume_up" size={26} />
          {t(voiceOn ? "vOn" : "vOff")}
        </button>
      </div>

      <div className={styles.talkLayout}>
      <div className={ui.card} style={{ marginTop: 22, borderRadius: 26 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span className={styles.roundBadge} aria-hidden="true">
            म
          </span>
          <p style={{ margin: 0, flex: 1, fontSize: "1.45em", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {t(convo.askKey, { name: patient.displayName })}
          </p>
          <button type="button" className={styles.repeat} aria-label="Repeat" onClick={() => ask(node)}>
            <Icon name="volume_up" size={30} />
          </button>
        </div>
        <div className={ui.stack} style={{ marginTop: 18 }}>
          {convo.options.map((opt) => (
            <button key={opt.labelKey} type="button" className={styles.convoOption} onClick={() => pickOption(opt)}>
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div>
      <div style={{ marginTop: 24, display: "grid", placeItems: "center" }}>
        <button type="button" className={styles.mic} aria-pressed={listening} aria-label={t(listening ? "vListening" : "vTapToSpeak")} onClick={() => void onMic()} disabled={busy}>
          <Icon name="mic" size={68} />
        </button>
        <p style={{ margin: "14px 0 0", fontWeight: 800, fontSize: "1.15em" }} aria-live="polite">
          {t(listening ? "vListening" : "vTapToSpeak")}
        </p>
      </div>

      {exchange.heard && (
        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
          <p className={styles.bubbleMine}>{exchange.heard}</p>
        </div>
      )}
      {exchange.reply && (
        <>
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span className={styles.roundBadge} style={{ width: 44, height: 44 }} aria-hidden="true">
              M
            </span>
            <p className={styles.bubbleReply} aria-live="polite">
              {exchange.reply}
            </p>
          </div>
          {exchange.source && <p className={styles.source}>{t(exchange.source === "model" ? "talkModel" : "talkRule")}</p>}
        </>
      )}
      {exchange.confirm && <p className={styles.confirm}>{exchange.confirm}</p>}

      <div style={{ marginTop: 26, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {CHIPS.map((chip) => (
          <button key={chip.intent} type="button" className={styles.chip} onClick={() => answer(chip.intent, t(chip.labelKey))}>
            {t(chip.labelKey)}
          </button>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
}
