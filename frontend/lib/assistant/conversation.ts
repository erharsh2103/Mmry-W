/*
 * The talk companion: a guided conversation (no commands to remember) and
 * the spoken replies for each intent. The backend and its classifier decide
 * WHAT was asked; this composes the answer in the patient's language from
 * their own routine and people.
 */
import type { Translator } from "@/lib/i18n/translate";
import type { IntentId, Task } from "@/types/api";
import { taskLabel, taskTime } from "@/lib/routine/now";

export type ConvoAction = "game" | "check" | "med" | "today" | "people";

export interface ConvoOption {
  labelKey: string;
  replyKey: string;
  next?: ConvoNodeId;
  act?: ConvoAction;
}

export type ConvoNodeId = "start" | "offer" | "rest" | "help" | "closed";

export const CONVO: Record<ConvoNodeId, { askKey: string; options: ConvoOption[] }> = {
  start: {
    askKey: "cvMood",
    options: [
      { labelKey: "cvGood", next: "offer", replyKey: "cvGoodReply" },
      { labelKey: "cvOk", next: "offer", replyKey: "cvOkReply" },
      { labelKey: "cvTired", next: "rest", replyKey: "cvTiredReply" },
    ],
  },
  offer: {
    askKey: "cvOfferGame",
    options: [
      { labelKey: "cvYes", act: "game", replyKey: "cvGameReply" },
      { labelKey: "cvCheck", act: "check", replyKey: "cvCheckReply" },
      { labelKey: "cvNo", next: "help", replyKey: "cvNoReply" },
    ],
  },
  rest: {
    askKey: "cvRest",
    options: [
      { labelKey: "cvMed", act: "med", replyKey: "" },
      { labelKey: "cvToday", act: "today", replyKey: "" },
      { labelKey: "cvNothing", next: "closed", replyKey: "cvClosedReply" },
    ],
  },
  help: {
    askKey: "cvHelp",
    options: [
      { labelKey: "cvMed", act: "med", replyKey: "" },
      { labelKey: "cvToday", act: "today", replyKey: "" },
      { labelKey: "cvPeople", act: "people", replyKey: "" },
    ],
  },
  closed: { askKey: "cvClosed", options: [{ labelKey: "cvStartOver", next: "start", replyKey: "" }] },
};

export const CHIPS: { intent: Exclude<IntentId, "who" | "unknown">; labelKey: string }[] = [
  { intent: "med", labelKey: "chipMed" },
  { intent: "today", labelKey: "chipToday" },
  { intent: "game", labelKey: "chipGame" },
  { intent: "check", labelKey: "chipCheck" },
  { intent: "people", labelKey: "chipPeople" },
];

/* Where an intent navigates after answering, if anywhere. */
export const INTENT_ROUTE: Partial<Record<IntentId, string>> = {
  game: "/dashboard/activities/memory-cards",
  check: "/dashboard/check",
  people: "/dashboard/people",
};

export function replyFor(
  intent: IntentId,
  heard: string,
  tasks: Task[],
  people: { name: string; relation: string; note: string }[],
  t: Translator,
): string {
  const pending = tasks.filter((x) => !x.done);
  switch (intent) {
    case "med": {
      const med =
        tasks.find((x) => (x.labelKey === "task_med_am" || x.labelKey === "task_med_pm") && !x.done) ??
        tasks.find((x) => x.labelKey === "task_med_pm");
      return med ? t("vMed", { label: taskLabel(med, t), time: taskTime(med, t) }) : t("vAllDone");
    }
    case "today":
      if (!pending.length) return t("vAllDone");
      return t("vToday", { n: pending.length, list: pending.slice(0, 3).map((x) => taskLabel(x, t)).join(", ") });
    case "who": {
      const low = heard.toLowerCase();
      const found = people.find((p) => p.name && low.includes(p.name.toLowerCase()));
      return found ? t("vWho", { name: found.name, relation: found.relation, note: found.note }).trim() : t("vWhoAsk");
    }
    case "game":
      return t("vGame");
    case "check":
      return t("vCheck");
    case "people":
      return t("vPeople");
    default:
      return t("vUnknown");
  }
}
