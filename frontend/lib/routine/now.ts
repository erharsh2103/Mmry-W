/*
 * The home screen's "right now" card and the line spoken when a screen opens,
 * ported from the original app.
 */
import type { Translator } from "@/lib/i18n/translate";
import type { SessionSummary, Task } from "@/types/api";

export type NowKind = "task" | "activity" | "wait" | "done";

export interface NowCard {
  kind: NowKind;
  taskId?: string;
  icon: string;
  eyebrow: string;
  title: string;
  spoken: string;
}

export const taskLabel = (task: Task, t: Translator) => (task.labelKey ? t(task.labelKey) : task.label ?? "");

/* "17.5" -> "5:30", the 12-hour clock text the t8am/t1pm phrases are written around. */
function clockText(hour: number): string {
  let h = Math.floor(hour);
  let m = Math.round((hour - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  h = ((h % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
}

const partOfDayKey = (hour: number) =>
  hour < 5 ? "tNight" : hour < 12 ? "tMorning" : hour < 17 ? "tAfternoon" : hour < 20 ? "tEvening" : "tNight";

/*
 * Template tasks carry a time_key ("8:00 in the morning" in the patient's
 * language); a reminder the patient spoke has only an hour, so the same phrase
 * is built from that instead of showing no time at all.
 */
export const taskTime = (task: Task, t: Translator) =>
  task.timeKey
    ? t(task.timeKey)
    : Number.isFinite(task.hour)
      ? t(partOfDayKey(task.hour), { time: clockText(task.hour) })
      : "";

export function nowCard(tasks: Task[], sessions: SessionSummary[], t: Translator, spoken: Translator, now = new Date()): NowCard {
  const h = now.getHours() + now.getMinutes() / 60;
  const due = tasks.filter((x) => !x.done && x.hour <= h + 0.5).sort((a, b) => b.hour - a.hour)[0];
  if (due) {
    return {
      kind: "task", taskId: due.id, icon: due.icon,
      eyebrow: t("nowDue"), title: taskLabel(due, t),
      spoken: spoken("nowSpokenTask", { label: taskLabel(due, spoken) }),
    };
  }
  const next = tasks.filter((x) => !x.done && x.hour > h).sort((a, b) => a.hour - b.hour)[0];
  const playedRecently = sessions.some((s) => now.getTime() - Date.parse(s.playedAt) < 6 * 3_600_000);
  if (h >= 9 && h <= 19 && !playedRecently) {
    return { kind: "activity", icon: "🎲", eyebrow: t("nowFree"), title: t("nowActivity"), spoken: spoken("nowSpokenActivity") };
  }
  if (next) {
    return {
      kind: "wait", icon: next.icon, eyebrow: t("nowNothing"),
      title: t("nowNextTitle", { label: taskLabel(next, t) }), spoken: spoken("nowSpokenCalm"),
    };
  }
  return { kind: "done", icon: "spa", eyebrow: t("nowNothing"), title: t("nowAllDone"), spoken: spoken("nowAllDone") };
}

/* Local calendar day as YYYY-MM-DD: the routine resets at the patient's midnight, not UTC's. */
export function localDay(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
