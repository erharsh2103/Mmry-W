"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, type ApiError } from "@/lib/api";
import { EMOJIS } from "@/lib/games/data";
import { personText } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient, usePatient } from "@/hooks/usePatient";
import { usePeople } from "@/hooks/usePatientData";
import { useSpeech } from "@/hooks/useSpeech";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { StateMessage } from "@/components/ui/StateMessage";
import type { MemoryItem, MemoryVault, Person } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

const VAULT: { key: Exclude<keyof MemoryVault, "memories">; icon: string; label: string }[] = [
  { key: "home", icon: "home", label: "vaultHome" },
  { key: "doctor", icon: "stethoscope", label: "vaultDoctor" },
  { key: "emergency", icon: "call", label: "vaultEmergency" },
  { key: "medicines", icon: "medication", label: "vaultMeds" },
];

const BLANK = { name: "", relation: "", note: "", emoji: "👩", isPlace: false, image: null as string | null };

function compactImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("image read failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("image decode failed"));
      image.onload = () => {
        const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("canvas unavailable"));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.55));
      };
      image.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.readAsDataURL(file);
  });
}

export function PeopleScreen() {
  const patient = useCurrentPatient();
  const { unlocked, update } = usePatient();
  const { t, translatorFor } = useI18n();
  const { speak, speechLang, listen } = useSpeech();
  const people = usePeople();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraFallbackRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFallbackRef.current?.click();
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch {
        // Laptop webcams do not expose an environment-facing camera. Retry with
        // unrestricted video so desktop and mobile cameras use the same button.
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(name === "NotReadableError" ? t("memoryCameraBusy") : t("memoryCameraDenied"));
    }
  };

  const useNativeCamera = () => cameraFallbackRef.current?.click();

  const acceptCameraFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void compactImage(file).then((image) => setForm((current) => ({ ...current, image }))).catch(() => setError(t("memoryImageError")));
    event.target.value = "";
  };

  const captureCameraImage = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setForm((current) => ({ ...current, image: canvas.toDataURL("image/jpeg", 0.55) }));
    closeCamera();
  };
  const listenForName = async () => {
    try {
      const heard = await listen();
      if (heard.text.trim()) setForm((current) => ({ ...current, name: heard.text.trim().slice(0, 80) }));
    } catch {
      speak(t("memoryVoiceError"));
    }
  };

  const removeMemory = async (id: string) => {
    if (!unlocked) return;
    await update({ vault: { memories: (patient.vault.memories ?? []).filter((memory) => memory.id !== id) } });
  };

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
      if (form.image) {
        const memory: MemoryItem = {
          id: crypto.randomUUID(),
          kind: form.isPlace ? "object" : "family",
          title: form.name.trim(),
          note: form.note.trim(),
          image: form.image,
          createdAt: new Date().toISOString(),
        };
        await update({ vault: { memories: [memory, ...(patient.vault.memories ?? [])].slice(0, 30) } });
      }
      setForm(BLANK);
      setOpen(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.isNetwork ? t("errNetwork") : apiErr.details?.[0]?.message ?? t("errGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const renderPerson = (person: Person) => {
    const text = personText(person, t);
    const imageMemory = (patient.vault.memories ?? []).find((memory) => memory.title.toLowerCase() === text.name.toLowerCase());
    return (
      <article key={person.id} className={styles.personCard}>
        {imageMemory?.image ? <img src={imageMemory.image} alt={text.name} className={styles.personImage} /> : <div className={styles.personFace} aria-hidden="true">{person.emoji}</div>}
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
        {unlocked && (
          <button type="button" className={ui.danger} style={{ borderRadius: 8, borderColor: "var(--red)", color: "var(--red)" }} onClick={() => void remove(person.id)}>
            <Icon name="delete" size={26} />
            {t("remove")}
          </button>
        )}
        {unlocked && imageMemory && <button type="button" className={ui.outline} onClick={() => void removeMemory(imageMemory.id)}><Icon name="image_not_supported" size={24} />{t("memoryRemoveImage")}</button>}
      </article>
    );
  };

  const savedPeople = (people.data ?? []).filter((person) => !person.isPlace);
  const savedPlaces = (people.data ?? []).filter((person) => person.isPlace);

  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("people")}</h1>
      <p className={ui.pageSub}>{t("peopleSub")}</p>

      {open ? (
        <form className={ui.card} style={{ marginTop: 20 }} onSubmit={save} noValidate>
          <h2 className={ui.cardTitle}>{t("addPerson")}</h2>
          <div className={styles.emojiRow} role="radiogroup" aria-label={t("addPerson")}>
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" role="radio" aria-checked={form.emoji === emoji} className={styles.emojiChoice} onClick={() => setForm({ ...form, emoji })}>{emoji}</button>
            ))}
          </div>
          <div className={ui.stack} style={{ marginTop: 16 }}>
            <Field label={t("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
            <Field label={t("relation")} value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} maxLength={80} />
            <Field label={t("note")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} />
            <button type="button" className={ui.outline} onClick={() => void listenForName()}><Icon name="mic" size={24} />{t("memoryVoice")}</button>
            <div className={ui.field}>
              {t("memoryImage")}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                <label className={ui.outline} style={{ flex: "1 1 220px", minHeight: 52, cursor: "pointer" }}>
                  <Icon name="folder_open" size={24} />
                  {t("memoryChooseFile")}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void compactImage(file).then((image) => setForm({ ...form, image })).catch(() => setError(t("memoryImageError")));
                    }}
                  />
                </label>
                <input ref={cameraFallbackRef} type="file" accept="image/*" capture="environment" aria-label={t("memoryTakePhoto")} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} onChange={acceptCameraFile} />
                <button type="button" className={ui.outline} style={{ flex: "1 1 180px", minHeight: 52 }} onClick={() => void openCamera()}>
                  <Icon name="photo_camera" size={24} />
                  {t("memoryTakePhoto")}
                </button>
              </div>
              {cameraOpen && (
                <div style={{ marginTop: 12, border: "2px solid var(--navy)", borderRadius: 12, padding: 10, background: "var(--stone)" }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 8, background: "#101820" }} />
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button type="button" className={ui.primary} onClick={captureCameraImage}><Icon name="photo_camera" size={24} />{t("memoryCapture")}</button>
                    <button type="button" className={ui.outline} onClick={closeCamera}>{t("sosClose")}</button>
                  </div>
                </div>
              )}
              {cameraError && <p className={ui.formError} role="alert" style={{ marginTop: 8 }}>{cameraError}</p>}
              {cameraError && <button type="button" className={ui.outline} style={{ marginTop: 8 }} onClick={useNativeCamera}><Icon name="photo_camera" size={22} />{t("memoryUseDeviceCamera")}</button>}
            </div>
          </div>
          <button type="button" role="checkbox" aria-checked={form.isPlace} className={styles.toggleRow} style={{ marginTop: 14 }} onClick={() => setForm({ ...form, isPlace: !form.isPlace, emoji: !form.isPlace ? "🏡" : form.emoji })}>
            <Icon name={form.isPlace ? "check_box" : "check_box_outline_blank"} size={26} />
            {t("pfPlaceToggle")}
          </button>
          {error && <p className={ui.formError} role="alert" style={{ marginTop: 14 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="submit" className={ui.pillButton} disabled={busy}>{busy ? t("authWorking") : t("save")}</button>
            <button type="button" className={ui.outline} onClick={() => { setOpen(false); setError(""); }}>{t("sosClose")}</button>
          </div>
        </form>
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setOpen(true)}>
          <Icon name="add" size={26} /> {t("addPerson")}
        </button>
      )}

      {!people.data ? (
        <StateMessage loading={people.loading} error={people.error} onRetry={people.reload} />
      ) : (
        <>
          <h2 className={ui.cardTitle}>{t("people")}</h2>
          <div className={styles.cardGrid}>
            {savedPeople.map(renderPerson)}
          </div>
          <section style={{ marginTop: 24 }} aria-labelledby="places-title">
            <h2 id="places-title" className={ui.cardTitle}>{t("locPlaces")}</h2>
            <p className={ui.pageSub}>{t("locPlacesSub")}</p>
            {savedPlaces.length ? <div className={styles.cardGrid}>{savedPlaces.map(renderPerson)}</div> : <p className={ui.muted}>{t("locAddPlace")}</p>}
          </section>
        </>
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
                  {typeof patient.vault[item.key] === "string" ? patient.vault[item.key] || t("vaultEmpty") : t("vaultEmpty")}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
