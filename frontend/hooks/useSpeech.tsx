"use client";

/*
 * Speaking and listening through the browser's own speech APIs.
 *
 * Voices are chosen per language by lib/speech/voices.ts. Listening uses the
 * Web Speech recogniser; note that Chrome sends that audio to Google to be
 * recognised, and some browsers (Brave) switch the API off entirely, in which
 * case the talk screen's buttons still work.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { VOICE_LANGS } from "@/lib/i18n/languages";
import type { Vars } from "@/lib/i18n/translate";
import { resolveVoice, speakable, speechLanguage, type ResolvedVoice, type VoiceLike } from "@/lib/speech/voices";
import type { VoicePref } from "@/types/api";

export interface Heard {
  text: string;
  confidence: number;
}

export type ListenError = "no-speech" | "no-mic" | "unsupported" | "failed";

interface SpeechValue {
  voices: VoiceLike[];
  resolved: ResolvedVoice;
  /* language the spoken lines are written in (may be a readable stand-in) */
  speechLang: string;
  voiceOn: boolean;
  speak: (text: string) => void;
  say: (key: string, vars?: Vars) => void;
  cancel: () => void;
  listen: () => Promise<Heard>;
  listening: boolean;
  recognitionSupported: boolean;
}

const SpeechContext = createContext<SpeechValue | null>(null);

interface Props {
  voiceOn: boolean;
  voicePref: VoicePref;
  voiceRate: number;
  children: ReactNode;
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { 0: { 0: { transcript: string; confidence: number } } } }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export function SpeechProvider({ voiceOn, voicePref, voiceRate, children }: Props) {
  const { lang, ensure, translatorFor } = useI18n();
  const [voices, setVoices] = useState<VoiceLike[]>([]);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const load = () => setVoices(synth.getVoices().map((v) => ({ name: v.name, lang: v.lang })));
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  const resolved = useMemo(() => resolveVoice(lang, voices, voicePref), [lang, voices, voicePref]);
  const speechLang = useMemo(() => speechLanguage(lang, resolved), [lang, resolved]);

  useEffect(() => {
    void ensure(speechLang);
  }, [speechLang, ensure]);

  const cancel = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no synthesis */
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      const line = speakable(text);
      if (!voiceOn || !line || typeof window === "undefined" || !window.speechSynthesis) return;
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(line);
        u.rate = voiceRate;
        const match = resolved.voice ? synth.getVoices().find((v) => v.name === resolved.voice!.name) : undefined;
        if (match) {
          u.voice = match;
          u.lang = match.lang;
        } else {
          u.lang = resolved.tag;
        }
        synth.speak(u);
      } catch {
        /* speech is a convenience; the screen still shows everything */
      }
    },
    [voiceOn, voiceRate, resolved],
  );

  const say = useCallback((key: string, vars?: Vars) => speak(translatorFor(speechLang)(key, vars)), [speak, translatorFor, speechLang]);

  const recognitionCtor =
    typeof window !== "undefined"
      ? ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition)
      : undefined;

  const listen = useCallback(
    () =>
      new Promise<Heard>((resolve, reject) => {
        if (!recognitionCtor) return reject("unsupported" satisfies ListenError);
        cancel();
        try {
          const rec = new recognitionCtor();
          rec.lang = VOICE_LANGS[lang] ?? "en-IN";
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          recognition.current = rec;
          let settled = false;
          rec.onresult = (e) => {
            settled = true;
            const best = e.results[0][0];
            resolve({ text: best.transcript, confidence: typeof best.confidence === "number" ? best.confidence : 0.9 });
          };
          rec.onerror = (e) => {
            settled = true;
            const kind = e?.error ?? "";
            reject(
              (kind === "no-speech"
                ? "no-speech"
                : kind === "not-allowed" || kind === "service-not-allowed" || kind === "audio-capture"
                  ? "no-mic"
                  : "failed") satisfies ListenError,
            );
          };
          rec.onend = () => {
            setListening(false);
            if (!settled) reject("no-speech" satisfies ListenError);
          };
          setListening(true);
          rec.start();
        } catch {
          setListening(false);
          reject("no-mic" satisfies ListenError);
        }
      }),
    [recognitionCtor, lang, cancel],
  );

  useEffect(() => () => recognition.current?.abort(), []);

  const value = useMemo<SpeechValue>(
    () => ({ voices, resolved, speechLang, voiceOn, speak, say, cancel, listen, listening, recognitionSupported: !!recognitionCtor }),
    [voices, resolved, speechLang, voiceOn, speak, say, cancel, listen, listening, recognitionCtor],
  );
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): SpeechValue {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error("useSpeech must be used inside <SpeechProvider>");
  return ctx;
}
