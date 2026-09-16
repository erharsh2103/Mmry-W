"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import { answerFor, buildCheckSteps, scoreMulti, type CheckStep } from "@/lib/check/steps";
import { toPersonCards } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { resourceKey, useMindChecks, usePeople } from "@/hooks/usePatientData";
import { invalidate } from "@/hooks/useResource";
import { useSpeech } from "@/hooks/useSpeech";
import { AreaBars } from "@/components/ui/AreaBars";
import { Icon } from "@/components/ui/Icon";
import { Progress } from "@/components/ui/Progress";
import { StateMessage } from "@/components/ui/StateMessage";
import { TileGrid } from "@/components/ui/TileGrid";
import type { MindCheck, MindCheckAnswer } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

interface Run {
  steps: CheckStep[];
  i: number;
  answers: MindCheckAnswer[];
  picked: string[];
  seconds: number;
  askedAt: number;
}

export const scoreLevelKey = (score: number | null) =>
  score === null || score === 0 ? "lvNone" : score <= 30 ? "lv1" : score <= 50 ? "lv2" : score <= 70 ? "lv3" : score <= 85 ? "lv4" : "lv5";

export function CheckScreen() {
  const patient = useCurrentPatient();
  const { t } = useI18n();
  const { say } = useSpeech();
  const people = usePeople();
  const history = useMindChecks(1);
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<MindCheck | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const clientRef = useRef<string>("");

  const ask = useCallback(
    (step: CheckStep, seconds: number) => say(step.questionKey, { n: 3, s: seconds }),
    [say],
  );

  const begin = () => {
    const steps = buildCheckSteps(toPersonCards(people.data ?? [], t), t);
    clientRef.current = crypto.randomUUID();
    setResult(null);
    setError(null);
    const first = steps[0]!;
    setRun({ steps, i: 0, answers: [], picked: [], seconds: first.seconds ?? 0, askedAt: Date.now() });
    ask(first, first.seconds ?? 0);
  };

  const finish = useCallback(
    async (answers: MindCheckAnswer[]) => {
      setRun(null);
      setSaving(true);
      try {
        const { mindCheck } = await api.mindChecks.record(patient.id, {
          clientRef: clientRef.current,
          takenAt: new Date().toISOString(),
          answers,
        });
        setResult(mindCheck);
        invalidate(resourceKey(patient.id, "checks"));
        invalidate(resourceKey(patient.id, "insights"));
        say("qDoneSpoken", { p: mindCheck.overall });
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setSaving(false);
      }
    },
    [patient.id, say],
  );

  const advance = useCallback(
    (current: Run, score: number) => {
      const step = current.steps[current.i]!;
      const answer = answerFor(step, score, Date.now() - current.askedAt);
      const answers = answer ? [...current.answers, answer] : current.answers;
      if (current.i + 1 >= current.steps.length) return void finish(answers);
      const next = current.steps[current.i + 1]!;
      setRun({ ...current, i: current.i + 1, answers, picked: [], seconds: next.seconds ?? 0, askedAt: Date.now() });
      ask(next, next.seconds ?? 0);
    },
    [finish, ask],
  );

  // The "look" step counts down, then moves on by itself.
  useEffect(() => {
    if (!run || run.steps[run.i]?.kind !== "show") return;
    const id = setTimeout(() => {
      if (run.seconds <= 1) advance(run, 1);
      else setRun({ ...run, seconds: run.seconds - 1 });
    }, 1000);
    return () => clearTimeout(id);
  }, [run, advance]);

  if (saving) return <StateMessage loading />;

  if (run) {
    const step = run.steps[run.i]!;
    const isMulti = step.kind === "multi";
    const tiles = step.tiles.map((tile) => ({
      key: tile.key,
      icon: tile.icon,
      label: tile.label,
      sub: tile.sub ?? "",
      tone: run.picked.includes(tile.key) ? ("picked" as const) : ("idle" as const),
      disabled: step.kind === "show",
    }));
    return (
      <div className={ui.screen}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={styles.areaPill}>{t(`a_${step.area}`)}</span>
          <span style={{ fontWeight: 700, color: "var(--muted)" }}>{t("qStep", { n: run.i + 1, m: run.steps.length })}</span>
          <button type="button" className={ui.outline} style={{ marginLeft: "auto", width: "auto", borderRadius: 8, background: "var(--cream)" }} aria-label="Repeat" onClick={() => ask(step, run.seconds)}>
            <Icon name="volume_up" size={30} />
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Progress value={((run.i + 1) / run.steps.length) * 100} />
        </div>
        <div className={styles.board}>
          <p className={styles.prompt} aria-live="polite">
            {t(step.questionKey, { n: 3, s: run.seconds })}
          </p>
          <p className={styles.promptSub}>{t(isMulti ? "qHintMulti" : step.kind === "show" ? "qHintLook" : "qHintOne")}</p>
          {step.kind === "show" && step.seconds && (
            <div style={{ marginTop: 16 }}>
              <Progress value={(run.seconds / step.seconds) * 100} height={12} />
            </div>
          )}
          {step.face && (
            <div className={ui.faceCard} aria-hidden="true">
              {step.face.emoji}
            </div>
          )}
          <TileGrid
            tiles={tiles}
            cols={step.tiles.length > 4 ? 3 : step.tiles.length}
            onPick={(key) => {
              if (step.kind === "show") return;
              if (isMulti) {
                setRun({ ...run, picked: run.picked.includes(key) ? run.picked.filter((x) => x !== key) : [...run.picked, key] });
              } else {
                advance(run, step.tiles.find((x) => x.key === key)?.ok ? 1 : 0);
              }
            }}
          />
          {isMulti && (
            <button type="button" className={ui.pillButtonGreen} style={{ marginTop: 22, padding: 20, fontSize: "1.15em" }} onClick={() => advance(run, scoreMulti(step, run.picked))}>
              {t("done")}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className={ui.screen}>
        <h1 className={ui.pageTitle} style={{ fontSize: "2.1em" }}>
          {t("checkResultTitle")}
        </h1>
        <div className={ui.card} style={{ marginTop: 18, borderRadius: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div className={styles.scoreCircle}>{result.overall}%</div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1em" }}>{t(scoreLevelKey(result.overall))}</p>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontWeight: 600 }}>{(result.avgResponseMs / 1000).toFixed(1)}s</p>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <AreaBars check={result} />
          </div>
          <p className={ui.muted} style={{ margin: "16px 0 0" }}>
            {t("checkResultNote")}
          </p>
          <button type="button" className={ui.outline} style={{ marginTop: 18, borderRadius: 999, fontWeight: 800 }} onClick={begin}>
            {t("checkAgain")}
          </button>
        </div>
      </div>
    );
  }

  const latest = history.data?.[0] ?? null;
  return (
    <div className={ui.screen}>
      <h1 className={ui.pageTitle}>{t("checkTitle")}</h1>
      <p className={ui.pageSub}>{t("checkSub")}</p>
      {error && <StateMessage error={error} />}
      <button type="button" className={styles.startCheck} onClick={begin} disabled={!people.data}>
        <span className={styles.startCheckIcon}>
          <Icon name="psychology" size={40} color="var(--green)" />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: "1.3em", fontWeight: 800 }}>{t("checkStart")}</span>
          <span style={{ display: "block", fontWeight: 600 }}>{t("checkTime")}</span>
        </span>
        <span style={{ fontSize: "1.6em", fontWeight: 800 }} aria-hidden="true">
          ›
        </span>
      </button>
      <div className={ui.card} style={{ marginTop: 20 }}>
        <h2 className={ui.cardTitle}>{t("checkResultTitle")}</h2>
        <p className={ui.muted} style={{ margin: "8px 0 16px" }}>
          {latest
            ? t("qBaseNote", { d: new Date(latest.takenAt).toLocaleDateString(), p: latest.overall, s: (latest.avgResponseMs / 1000).toFixed(1) })
            : t("qBaseNone")}
        </p>
        <AreaBars check={latest} />
        <p className={ui.muted} style={{ margin: "14px 0 0" }}>
          {t("checkResultNote")}
        </p>
      </div>
    </div>
  );
}
