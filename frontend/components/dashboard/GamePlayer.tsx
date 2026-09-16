"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError } from "@/lib/api";
import { resultOf, view } from "@/lib/games/engine";
import { toPersonCards } from "@/lib/people";
import { useI18n } from "@/hooks/useI18n";
import { useGame } from "@/hooks/useGame";
import { useCurrentPatient } from "@/hooks/usePatient";
import { resourceKey, useInsights, usePeople } from "@/hooks/usePatientData";
import { invalidate, setResource } from "@/hooks/useResource";
import { useSessionQueue } from "@/hooks/useSessionQueue";
import { useSpeech } from "@/hooks/useSpeech";
import { Progress } from "@/components/ui/Progress";
import { StateMessage } from "@/components/ui/StateMessage";
import { TileGrid } from "@/components/ui/TileGrid";
import type { GameType } from "@/types/api";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

/* Waits for the level and the people list, then mounts the board. */
export function GamePlayer({ game }: { game: GameType }) {
  const insights = useInsights();
  const people = usePeople();
  const { t } = useI18n();
  // Chosen once, from fresh insights: a later background refresh must not restart the game.
  const [level, setLevel] = useState<number | null>(null);
  const settled = !insights.loading && (!!insights.data || !!insights.error);
  const recommended = insights.data?.levels[game]?.level;

  useEffect(() => {
    // If insights cannot load (e.g. offline) the game still starts, at level 1.
    if (level === null && settled) setLevel(recommended ?? 1);
  }, [level, settled, recommended]);

  if (!people.data || level === null) {
    return <StateMessage loading error={people.error} onRetry={people.reload} />;
  }
  return <Board game={game} level={level} people={toPersonCards(people.data, t)} />;
}

function Board({ game, level, people }: { game: GameType; level: number; people: ReturnType<typeof toPersonCards> }) {
  const router = useRouter();
  const patient = useCurrentPatient();
  const { t, translatorFor } = useI18n();
  const { speak, speechLang, cancel } = useSpeech();
  const queue = useSessionQueue(patient.id);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  const { state, pick, done } = useGame({
    game,
    level,
    people,
    onFinish: (outcome, session) => {
      setResource(resourceKey(patient.id, "lastResult"), resultOf(outcome.accuracy, level, t));
      queue
        .record(session)
        .then(() => {
          invalidate(resourceKey(patient.id, "tasks"));
          invalidate(resourceKey(patient.id, "insights"));
          invalidate(resourceKey(patient.id, "sessions"));
          router.push("/dashboard/activities");
        })
        .catch((err: ApiError) => setSaveError(err));
    },
  });

  const board = useMemo(() => (state ? view(state, t, translatorFor(speechLang)) : null), [state, t, translatorFor, speechLang]);

  // Read each new question aloud once.
  const spokenStage = useRef("");
  useEffect(() => {
    if (!board || spokenStage.current === board.stageKey) return;
    spokenStage.current = board.stageKey;
    const id = setTimeout(() => speak(board.spoken), 120);
    return () => clearTimeout(id);
  }, [board, speak]);

  if (saveError) return <StateMessage error={saveError} onRetry={() => router.push("/dashboard/activities")} />;
  if (!board) return <StateMessage loading />;

  return (
    <div className={ui.screen}>
      <div className={styles.gameTop}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => {
            cancel();
            router.push("/dashboard/activities");
          }}
        >
          ← {t("back")}
        </button>
        <span style={{ fontWeight: 700, color: "var(--muted)" }}>
          {board.title} · {t("level")} {board.level}
        </span>
      </div>

      <div className={styles.board}>
        <p className={styles.prompt} aria-live="polite">
          {board.prompt}
        </p>
        <p className={styles.promptSub}>{board.sub}</p>

        {board.timerPct !== undefined && (
          <div style={{ marginTop: 16 }}>
            <Progress value={board.timerPct} height={12} />
          </div>
        )}

        {board.answerRow && (
          <div className={styles.answerRow}>
            {board.answerEmpty && <span style={{ padding: "0 6px", color: "var(--muted)", fontWeight: 600 }}>{t("startMorning")}</span>}
            {board.answerRow.map((a) => (
              <span key={a.key} className={styles.answerChip} data-ok={a.ok === null ? undefined : a.ok}>
                <span style={{ fontSize: "1.2em" }} aria-hidden="true">
                  {a.icon}
                </span>
                {a.n}. {a.label}
              </span>
            ))}
          </div>
        )}

        {board.faceCard && (
          <div className={ui.faceCard} aria-hidden="true">
            {board.faceCard.emoji}
          </div>
        )}

        <TileGrid tiles={board.tiles} cols={board.cols} onPick={pick} />

        {board.showDone && (
          <button type="button" className={ui.pillButtonGreen} style={{ marginTop: 22, padding: 20, fontSize: "1.15em" }} onClick={done}>
            {t("done")}
          </button>
        )}

        <p className={styles.footer}>{board.footer}</p>
      </div>
    </div>
  );
}
