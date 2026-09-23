/*
 * Talk companion: decide what the patient asked for.
 *
 * The scikit-learn classifier in the AI service answers first. When it is
 * unreachable, the keyword rule from the original app answers instead, so the
 * companion never goes silent. Replies are composed by the frontend in the
 * patient's language from the returned intent.
 *
 * What the patient said is stored only encrypted, with a 180-day expiry.
 */
import { logger } from "../config/logger.js";
import type { Patient } from "../models/patient.js";
import type { Person, Task } from "../models/routine.js";
import { assistantTurnsRepository } from "../repositories/documents.repository.js";
import { encrypt } from "../utils/crypto.js";
import { aiClient } from "./aiClient.service.js";
import { patientService } from "./patient.service.js";
import { parseAddReminder } from "./reminderParser.js";
import { peopleService, routineService } from "./routine.service.js";
import { safetyService } from "./safety.service.js";

export const INTENT_IDS = ["med", "today", "who", "game", "check", "people", "unknown"] as const;
export type IntentId = (typeof INTENT_IDS)[number];

/* Keyword rule from the original app - the fallback classifier. */
const KEYWORDS: { id: Exclude<IntentId, "unknown">; words: string[] }[] = [
  { id: "med", words: ["medicine", "medication", "tablet", "dawa", "davaa", "दवा", "दवाई", "ওষুধ", "మందు", "ಔಷಧಿ", "മരുന്ന്", "மாத்திரை", "دوا"] },
  { id: "today", words: ["today", "schedule", "routine", "aaj", "आज", "दिनचर्या", "আজ", "இன்று", "నేడు", "ಇಂದು", "ഇന്ന്", "آج"] },
  { id: "who", words: ["who is", "who's", "kaun", "कौन", "কে", "யார்", "ఎవరు", "ಯಾರು", "ആരാണ്", "کون"] },
  { id: "game", words: ["game", "play", "khel", "खेल", "খেল", "ஆட்டம்", "ఆట", "ಆಟ", "കളി", "کھیل"] },
  { id: "check", words: ["mind check", "question", "sawal", "सवाल", "प्रश्न", "প্রশ্ন", "கேள்வி", "ప్రశ్న", "ಪ್ರಶ್ನೆ", "ചോദ്യം", "سوال"] },
  { id: "people", words: ["family", "people", "parivar", "परिवार", "পরিবার", "குடும்பம்", "కుటుంబం", "ಕುಟುಂಬ", "കുടുംബം", "خاندان"] },
];

export function keywordIntent(text: string): IntentId {
  const low = ` ${text.toLowerCase()} `;
  return KEYWORDS.find((k) => k.words.some((w) => low.includes(w)))?.id ?? "unknown";
}

export interface IntentOutcome {
  intent: IntentId;
  confidence: number;
  source: "model" | "rule";
  modelVersion: string | null;
}

export interface AssistantAnswer extends IntentOutcome {
  reply: string;
  action: { type: "navigate"; route: string } | null;
  created?: { kind: "reminder"; task: Task } | null;
}

const ROUTES: Partial<Record<IntentId, string>> = {
  game: "/dashboard/activities",
  check: "/dashboard/check",
  people: "/dashboard/people",
};

/* hour is numeric(4,2), so 10.5 means half past ten - never render it as "10.5:00". */
const hourLabel = (hour: number) => {
  const total = Math.round((((hour % 24) + 24) % 24) * 60);
  const h = Math.floor(total / 60) % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const twelve = h % 12 || 12;
  return `${twelve}:${String(total % 60).padStart(2, "0")} ${suffix}`;
};

const label = (task: Task) => task.label ?? task.labelKey?.replace(/^task_/, "").replace(/_/g, " ") ?? "task";
const personName = (person: Person) => person.name ?? person.nameKey?.replace(/^person_/, "").replace(/_/g, " ") ?? "";
const today = () => new Date().toISOString().slice(0, 10);
const isTimeQuestion = (text: string) => /\b(?:what(?:'s| is)?\s+(?:the\s+)?(?:current\s+)?time|time\s+is\s+it|current\s+time|tell(?: me)?\s+(?:the\s+)?(?:current\s+)?time|time\s+now|what\s+is\s+the\s+clock|clock)\b|समय|टाइम/i.test(text);

function clockLabel(date: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
  } catch {
    return date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
  }
}

function dateLabel(date: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(date);
  } catch {
    return date.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
  }
}

function appCommand(text: string): { intent: IntentId; route?: string; reply: string } | null {
  const low = text.toLowerCase();
  const wantsNav = /\b(open|show|go|take me|start|launch)\b/.test(low);
  if (wantsNav && /\b(remember|memory|memories|photo|object)\b/.test(low)) {
    return { intent: "people", route: "/dashboard/people", reply: "Opening memory pictures. You can name one by voice and add a photo." };
  }
  if (/\b(go|take me)\b.*\b(home|main screen|dashboard)\b/.test(low) || /\bhome screen\b/.test(low)) {
    return { intent: "unknown", route: "/dashboard", reply: "Opening home." };
  }
  if (!wantsNav) return null;
  if (/\b(day|routine|schedule|today|tasks?)\b/.test(low)) return { intent: "today", route: "/dashboard/day", reply: "Opening today's list." };
  if (/\b(play|game|activity|activities)\b/.test(low)) return { intent: "game", route: "/dashboard/activities", reply: "Opening activities." };
  if (/\b(check|mind check|questions?)\b/.test(low)) return { intent: "check", route: "/dashboard/check", reply: "Opening mind check." };
  if (/\b(people|family|faces?|person)\b/.test(low)) return { intent: "people", route: "/dashboard/people", reply: "Opening your people." };
  if (/\b(place|places|location|where am i|map)\b/.test(low)) return { intent: "unknown", route: "/dashboard/places", reply: "Opening places and your location." };
  if (/\b(talk|saathi|assistant|voice)\b/.test(low)) return { intent: "unknown", route: "/dashboard/talk", reply: "Opening AI Saathi." };
  return null;
}

function answerFromPatient(intent: IntentId, text: string, patient: Patient, tasks: Task[], people: Person[], safety: Awaited<ReturnType<typeof safetyService.state>>, timezone?: string): string {
  const low = text.toLowerCase();
  const pending = tasks.filter((task) => !task.done);
  if (/\b(help|what can you do|commands?|how do i)\b/.test(low)) {
    return "You can ask me the time, date, reminders, medicines, places, family, objects in your memories, your location, home, caregiver, doctor, or say open games, open memories, open places, or get help. You can also say remind me to take my medicine at 5 pm, and I will add it to your reminders.";
  }
  if (/\b(my name|who am i)\b/.test(low)) return `You are ${patient.displayName}.`;
  if (/\b(what time|time is it|current time|clock)\b/.test(low)) return `It is ${clockLabel(new Date(), timezone)}.`;
  if (/\b(what day|what date|today's date|date is it)\b/.test(low)) return `Today is ${dateLabel(new Date(), timezone)}.`;
  if (/\b(caregiver|carer)\b/.test(low)) {
    const parts = [patient.caregiverName, patient.caregiverPhone].filter(Boolean);
    return parts.length ? `Your caregiver is ${parts.join(", ")}.` : "I do not have caregiver details saved yet.";
  }
  if (/\b(doctor|medical contact)\b/.test(low)) return patient.vault.doctor || "I do not have doctor details saved yet.";
  if (/\b(emergency|sos)\b/.test(low)) return patient.vault.emergency || "I do not have emergency details saved yet.";
  if (/\b(address|home|where do i live)\b/.test(low)) return patient.vault.home || "I do not have your home details saved yet.";
  if (/\b(where am i|my location|my position|find me|locate me)\b/.test(low)) {
    if (!safety.lastFix) return "I do not have your current location yet. Please turn on location tracking.";
    const place = safety.outside ? "outside your usual safe area" : "inside your usual safe area";
    return `Your latest location is ${Math.round(safety.lastFix.lat * 100000) / 100000}, ${Math.round(safety.lastFix.lon * 100000) / 100000}. You are ${place}.`;
  }
  if (/\b(reminder|reminders|what is next|next thing|schedule|routine|today)\b/.test(low)) {
    if (!pending.length) return "You have no unfinished reminders today.";
    const next = pending.slice(0, 4).map((task) => `${label(task)} at ${hourLabel(task.hour)}`).join(", ");
    return `Your unfinished reminders are: ${next}.`;
  }
  if (/\b(place|places|where can i go|nearby|destination)\b/.test(low)) {
    const places = people.filter((person) => person.isPlace);
    return places.length ? `Your saved places are ${places.map(personName).join(", ")}.` : "No places have been saved yet. A caregiver can add one under People.";
  }
  if (/\b(memory|memories|remembered|object|photo|picture|family face)\b/.test(low)) {
    const memories = patient.vault.memories ?? [];
    return memories.length ? `You have saved ${memories.length} memories: ${memories.slice(0, 5).map((memory) => memory.title).join(", ")}.` : "You have no memory pictures saved yet. Open Memories to add a family face or familiar object.";
  }
  if (/\b(sos|emergency|help me|danger|lost)\b/.test(low)) return "I can help you contact your caregiver. Tap Get help on the home screen to send an SOS message with your latest location.";
  if (/\b(medicines?|medications?|tablets?)\b/.test(low) && patient.vault.medicines) return patient.vault.medicines;

  switch (intent) {
    case "med": {
      const med = pending.find((task) => /med|medicine|tablet/i.test(`${task.labelKey ?? ""} ${task.label ?? ""}`));
      return med ? `Your medicine is ${label(med)} at ${hourLabel(med.hour)}.` : "I do not see a pending medicine task right now.";
    }
    case "today":
      if (!pending.length) return "Everything on today's list is done.";
      return `You have ${pending.length} thing${pending.length === 1 ? "" : "s"} left today: ${pending.slice(0, 3).map(label).join(", ")}.`;
    case "who": {
      const found = people.find((p) => {
        const name = personName(p).toLowerCase();
        return name && low.includes(name);
      });
      if (!found) return "I can help if you ask about someone by name.";
      const relation = found.relation ?? found.relationKey?.replace(/^relation_/, "").replace(/_/g, " ") ?? "someone you know";
      const note = found.note ?? found.noteKey?.replace(/^note_/, "").replace(/_/g, " ") ?? "";
      return `${personName(found)} is ${relation}.${note ? ` ${note}` : ""}`;
    }
    case "game":
      return "I can open activities for you.";
    case "check":
      return "I can open the mind check for you.";
    case "people":
      return people.length ? `I found ${people.length} saved people and places.` : "No people are saved yet.";
    default:
      return "I can answer questions about your time, reminders, places, memories, location, medicines, family, doctor, caregiver, and safety. You can also ask me to open a patient screen.";
  }
}

export const assistantService = {
  async transcribe(audio: Buffer, contentType: string, lang: string) {
    return aiClient.transcribeAudio(audio, contentType, lang);
  },

  async classify(
    patientId: string,
    userId: string,
    input: { text: string; lang: string; source: "speech" | "chip"; speechConfidence: number | null },
  ): Promise<IntentOutcome> {
    const ai = await aiClient.classifyIntent(patientId, input.text, input.lang);
    const outcome: IntentOutcome = ai
      ? { intent: ai.intent, confidence: ai.confidence, source: "model", modelVersion: ai.model.version }
      : { intent: keywordIntent(input.text), confidence: 1, source: "rule", modelVersion: null };

    await assistantTurnsRepository
      .insert({
        patientId,
        userId,
        lang: input.lang,
        source: input.source,
        textEnc: encrypt(input.text),
        speechConfidence: input.speechConfidence,
        intent: outcome.intent,
        confidence: outcome.confidence,
        classifier: {
          name: ai ? ai.model.name : "keyword-rule",
          version: ai ? ai.model.version : "1",
          fallback: !ai,
        },
        createdAt: new Date(),
      })
      .catch((err: Error) => logger.warn("assistant turn not stored", { error: err.message }));

    return outcome;
  },

  async answer(
    patientId: string,
    userId: string,
    access: Patient["access"],
    input: { text: string; lang: string; source: "speech" | "chip"; speechConfidence: number | null; day?: string; timezone?: string },
  ): Promise<AssistantAnswer> {
    // Creating a reminder is answered here, before any AI call: it must keep
    // working when the Python service is down, and it changes stored data, so it
    // never rides on a classifier's guess.
    const wanted = parseAddReminder(input.text);
    if (wanted) {
      try {
        const { task } = await routineService.addTask(patientId, input.day ?? today(), wanted);
        return {
          intent: "today",
          confidence: 1,
          source: "rule",
          modelVersion: null,
          reply: `I added a reminder: ${task.label} at ${hourLabel(task.hour)}.`,
          action: null,
          created: { kind: "reminder", task },
        };
      } catch (err) {
        logger.warn("reminder not created", { error: (err as Error).message });
        return {
          intent: "today",
          confidence: 1,
          source: "rule",
          modelVersion: null,
          reply: "I could not save that reminder just now. Please try again in a moment.",
          action: null,
          created: null,
        };
      }
    }

    const command = appCommand(input.text);
    const localText = input.text.toLowerCase();
    const immediateIntent: IntentId = /\b(medicine|medication|tablet|dawa|दवा)\b/.test(localText)
      ? "med"
      : /\b(today|reminder|schedule|routine|next)\b/.test(localText)
        ? "today"
        : /\b(who|family|people|person|कौन)\b/.test(localText)
          ? "who"
          : "unknown";

    // Navigation and clock questions should never wait for another model.
    if (command?.route && /\b(open|show|go|take me|start|launch)\b/.test(localText)) {
      return { intent: command.intent, confidence: 1, source: "rule", modelVersion: null, reply: command.reply, action: { type: "navigate", route: command.route } };
    }
    if (isTimeQuestion(input.text) || /\b(what day|what date|today's date|date is it)\b/.test(localText)) {
      const reply = isTimeQuestion(input.text)
        ? `It is ${clockLabel(new Date(), input.timezone)}.`
        : `Today is ${dateLabel(new Date(), input.timezone)}.`;
      return { intent: "today", confidence: 1, source: "rule", modelVersion: null, reply, action: null };
    }
    const [patient, tasks, people, safety] = await Promise.all([
      patientService.get(patientId, access),
      routineService.listTasks(patientId, input.day ?? today()),
      peopleService.list(patientId),
      safetyService.state(patientId),
    ]);
    const intent = command?.intent ?? immediateIntent;
    const route = command?.route ?? ROUTES[intent] ?? null;
    const fallbackReply = answerFromPatient(intent, input.text, patient, tasks, people, safety, input.timezone);
    const geminiReply = !command && intent === "unknown"
      ? await aiClient.answerQuestion({
          question: input.text,
          lang: input.lang,
          context: {
            patientName: patient.displayName,
            reminders: tasks.map((task) => ({ label: label(task), hour: task.hour, done: task.done })),
            savedPeople: people.filter((person) => !person.isPlace).map((person) => ({ name: personName(person), relation: person.relation, note: person.note })),
            savedPlaces: people.filter((person) => person.isPlace).map((person) => ({ name: personName(person), note: person.note })),
            memories: (patient.vault.memories ?? []).map((memory) => ({ title: memory.title, note: memory.note, kind: memory.kind })),
            safety: { hasHome: !!safety.zone.home, hasRecentLocation: !!safety.lastFix, insideSafeZone: !safety.outside },
          },
        })
      : null;
    return {
      intent,
      confidence: 1,
      source: "rule",
      modelVersion: null,
      reply: command?.reply ?? geminiReply ?? fallbackReply,
      action: route ? { type: "navigate", route } : null,
    };
  },
};
