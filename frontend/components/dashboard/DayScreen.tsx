"use client";

import { api } from "@/lib/api";
import { localDay, taskLabel, taskTime } from "@/lib/routine/now";
import { useClock } from "@/hooks/useClock";
import { useI18n } from "@/hooks/useI18n";
import { useCurrentPatient } from "@/hooks/usePatient";
import { LIVE, resourceKey, useTasks } from "@/hooks/usePatientData";
import { invalidate } from "@/hooks/useResource";
import { useSpeech } from "@/hooks/useSpeech";
import { Icon } from "@/components/ui/Icon";
import { StateMessage } from "@/components/ui/StateMessage";
import ui from "@/components/ui/ui.module.css";
import styles from "./screens.module.css";

export function DayScreen() {
  const patient = useCurrentPatient();
  const { t } = useI18n();
  const { speak, say } = useSpeech();
  // Re-evaluated every minute, so the routine resets at local midnight on an open screen.
  const day = localDay(useClock(60_000));
  const tasks = useTasks(day, LIVE.routine);
  const list = tasks.data ?? [];
  const done = list.filter((x) => x.done).length;

  const toggle = async (taskId: string, wasDone: boolean, label: string) => {
    // Optimistic: the tick appears at once; the server response then replaces it.
    tasks.mutate(list.map((x) => (x.id === taskId ? { ...x, done: !wasDone } : x)));
    if (wasDone) speak(label);
    else say("nowThanks");
    try {
      tasks.mutate((await api.tasks.set(patient.id, taskId, day, !wasDone)).tasks);
      invalidate(resourceKey(patient.id, "insights"));
    } catch {
      void tasks.reload();
    }
  };

  return (
    <div className={ui.screen}>
      <h1 className={styles.centerTitle}>{t("dayTitle")}</h1>
      <p className={styles.centerSub}>{t("daySub")}</p>

      {!tasks.data ? (
        <StateMessage loading={tasks.loading} error={tasks.error} onRetry={tasks.reload} />
      ) : (
        <>
          <div className={styles.tasks} role="list">
            {list.map((task) => {
              const label = taskLabel(task, t);
              return (
                <button
                  key={task.id}
                  type="button"
                  role="checkbox"
                  aria-checked={task.done}
                  className={styles.task}
                  onClick={() => void toggle(task.id, task.done, label)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                    <Icon name={task.icon} size={48} />
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.taskTime}>{taskTime(task, t)}</span>
                      <span className={styles.taskLabel}>{label}</span>
                    </span>
                  </span>
                  <span className={styles.taskRing}>
                    <Icon name="check" size={32} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className={ui.card} style={{ marginTop: 22, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontWeight: 700, color: "var(--muted)" }}>{t("todaySoFar")}</span>
              <span style={{ fontWeight: 700, fontSize: "1.2em" }}>
                {done} / {list.length}
              </span>
            </div>
            <div className={styles.dots} aria-hidden="true">
              {list.map((task) => (
                <span key={task.id} className={styles.dot} data-done={task.done} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
