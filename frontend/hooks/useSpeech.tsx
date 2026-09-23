"use client";

/*
 * Speaking through the browser's speech synthesis and listening through the
 * local faster-whisper service.
 *
 * Voices are chosen per language by lib/speech/voices.ts. Listening uses the
 * MediaRecorder captures a short clip and sends it to the authenticated
 * backend, which forwards it to the local faster-whisper service.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { api } from "@/lib/api";
import { VOICE_LANGS } from "@/lib/i18n/languages";
import type { Vars } from "@/lib/i18n/translate";
import { resolveVoice, speakable, speechLanguage, type ResolvedVoice, type VoiceLike } from "@/lib/speech/voices";
import type { VoicePref } from "@/types/api";

export interface Heard {
  text: string;
  confidence: number;
}

export type ListenError = "no-speech" | "no-mic" | "unsupported" | "failed" | "aborted";

/* idle -> waiting (browser may be asking for mic permission) -> listening (mic is open) */
export type MicState = "idle" | "waiting" | "listening";

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
  stopListening: () => void;
  micState: MicState;
  /* true only once the microphone is actually open */
  listening: boolean;
  recognitionSupported: boolean;
}

const SpeechContext = createContext<SpeechValue | null>(null);

/* Endpointing bounds, in ms. Generous: a slow speaker pausing to think is normal. */
const MIN_CLIP = 1_200;
const MAX_CLIP = 20_000;
const TRAILING_SILENCE = 1_600;

/*
 * Watches the live mic level and calls back once the speaker has been quiet for
 * TRAILING_SILENCE. The floor adapts to the room: it settles on the quietest
 * level seen so far, so a noisy kitchen does not read as constant speech.
 */
function listenForSilence(stream: MediaStream, done: () => void): { stop: () => void } {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const started = Date.now();
  let stopped = false;
  const hardStop = window.setTimeout(finish, MAX_CLIP);

  function finish() {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(hardStop);
    try {
      void ctx?.close();
    } catch {
      /* already closed */
    }
    done();
  }

  if (!Ctor) return { stop: finish }; // no WebAudio: MAX_CLIP is the only bound
  let ctx: AudioContext | undefined;
  try {
    ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let floor = 0.01;
    let lastLoud = Date.now();

    const tick = () => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const sample of buffer) sum += sample * sample;
      const level = Math.sqrt(sum / buffer.length);
      floor = Math.min(floor, Math.max(level, 0.002));
      const now = Date.now();
      // Speech sits well above the room's own hum; 3x the floor separates them
      // without needing a fixed threshold that breaks in a quiet or loud house.
      if (level > Math.max(floor * 3, 0.012)) lastLoud = now;
      if (now - started > MIN_CLIP && now - lastLoud > TRAILING_SILENCE) return finish();
      window.setTimeout(tick, 100);
    };
    tick();
  } catch {
    return { stop: finish }; // WebAudio unavailable; fall back to MAX_CLIP
  }
  return { stop: finish };
}

interface Props {
  patientId?: string;
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
  onaudiostart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export function SpeechProvider({ patientId, voiceOn, voicePref, voiceRate, children }: Props) {
  const { lang, ensure, translatorFor } = useI18n();
  const [voices, setVoices] = useState<VoiceLike[]>([]);
  const [micState, setMicState] = useState<MicState>("idle");
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

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
      new Promise<Heard>(async (resolve, reject) => {
        if (!patientId || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return reject("unsupported" satisfies ListenError);
        cancel();
        let stream: MediaStream | null = null;
        let endpoint: { stop: () => void } | undefined;
        try {
          // The browser's own echo/noise/gain processing is the first filter; a
          // single 16 kHz channel is exactly what whisper resamples to anyway.
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
              sampleRate: 16_000,
            },
          });
          const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
          const chunks: BlobPart[] = [];
          const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          recorder.current = rec;
          rec.ondataavailable = (event) => event.data.size && chunks.push(event.data);
          rec.onerror = () => reject("failed" satisfies ListenError);
          rec.onstop = async () => {
            endpoint?.stop();
            stream?.getTracks().forEach((track) => track.stop());
            recorder.current = null;
            setMicState("idle");
            try {
              const result = await api.assistant.transcribe(patientId, new Blob(chunks, { type: rec.mimeType || "audio/webm" }), lang);
              resolve({ text: result.text, confidence: result.confidence });
            } catch {
              reject("failed" satisfies ListenError);
            }
          };
          rec.start();
          setMicState("listening");
          // Stop when the speaker stops, not on a stopwatch: a fixed window cut
          // slower sentences in half, which is what whisper then had to guess at.
          endpoint = listenForSilence(stream, () => {
            if (rec.state === "recording") rec.stop();
          });
        } catch {
          stream?.getTracks().forEach((track) => track.stop());
          setMicState("idle");
          reject("no-mic" satisfies ListenError);
        }
      }),
    [patientId, lang, cancel],
  );

  const stopListening = useCallback(() => {
    recorder.current?.stop();
    recognition.current?.abort();
  }, []);

  useEffect(() => () => {
    recorder.current?.stop();
    recognition.current?.abort();
  }, []);

  const listening = micState === "listening";

  const localRecognitionSupported = !!patientId && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const value = useMemo<SpeechValue>(
    () => ({ voices, resolved, speechLang, voiceOn, speak, say, cancel, listen, stopListening, micState, listening, recognitionSupported: localRecognitionSupported }),
    [voices, resolved, speechLang, voiceOn, speak, say, cancel, listen, stopListening, micState, listening, localRecognitionSupported],
  );
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): SpeechValue {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error("useSpeech must be used inside <SpeechProvider>");
  return ctx;
}
