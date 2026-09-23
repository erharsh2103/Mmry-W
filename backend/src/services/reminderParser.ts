/*
 * "Remind me to take my medicine at 5 pm" -> { label: "take my medicine", hour: 17 }.
 *
 * Deterministic on purpose. Creating a reminder has to keep working when the
 * Python AI service is down, and a wrong guess writes junk into a routine the
 * patient cannot easily audit - so anything ambiguous returns null and the
 * read-only assistant answers instead.
 */

export interface ParsedReminder {
  label: string;
  hour: number;
}

/* Spoken times that carry no digits, mapped to the hour a care routine means by them. */
const NAMED_HOURS: Record<string, number> = {
  midnight: 0,
  breakfast: 8,
  morning: 9,
  noon: 12,
  midday: 12,
  lunch: 13,
  afternoon: 15,
  teatime: 16,
  evening: 18,
  dinner: 20,
  supper: 20,
  night: 21,
  bedtime: 21,
};

/* Questions about the list that already exists must never create anything. */
const READ_ONLY = /^(?:what|when|which|who|whose|how\s+many|do\s+i|did\s+i|have\s+i|am\s+i|is\s+there|are\s+there|any|list|read|show|tell)\b/;

const OPENER = String.raw`^(?:please\s+)?(?:can|could|would|will)?\s*(?:you\s+)?(?:please\s+)?`;
const VERB = String.raw`(?:add|set|create|make|put|schedule)`;
const NOUN = String.raw`(?:reminder|alarm|task|note)s?`;

/* The left edge of a create command - everything it matches is dropped from the label. */
const CREATE = new RegExp(
  `${OPENER}(?:${VERB}\\s+(?:up\\s+)?(?:a\\s+|an\\s+|the\\s+)?(?:new\\s+)?${NOUN}|remind\\s+me|remember\\s+to|don'?t\\s+let\\s+me\\s+forget|new\\s+reminder)\\b`,
  "i",
);

/*
 * "Add water reminder at 2.30 pm" - the thing to be reminded of sits between the
 * verb and the noun, so it is captured here rather than left in the remainder.
 */
const CREATE_NOUN_LAST = new RegExp(`${OPENER}${VERB}\\s+(?:a\\s+|an\\s+|the\\s+)?(?:new\\s+)?(.{1,60}?)\\s+${NOUN}\\b`, "i");

/*
 * Speech-to-text hears "at" as "add" or "and" ("...reminder add 2.30 PM"). Only
 * rewritten when what follows is unmistakably a clock time, so "add 2 tablets"
 * is left alone.
 */
const HEARD_AS_AT = /\b(?:add|and)\s+(?=\d{1,2}\s*(?:[:.]\s*\d{2}|\s+\d{2}\s*[ap]\.?\s?m|\s*[ap]\.?\s?m|\s*o'?\s?clock))/gi;

/* Filler left behind once the command and the time are gone. */
const CONNECTIVES = /^(?:please\s+|that\s+|to\s+|for\s+|about\s+|i\s+(?:need|have|want|should|must)\s+to\s+|me\s+to\s+|my\s+)+/;
const TRAILING = /(?:\s+(?:please|for\s+me|thanks|thank\s+you))+$/;

const MINUTE = String.raw`[0-5]\d`;
const MER = String.raw`(?:\s*(a\.?\s?m\.?|p\.?\s?m\.?))`;

/*
 * Ordered widest-match-first: "half past 5 pm" must not be eaten by the bare
 * "5 pm" rule. Each entry returns the hour, or null when the numbers are
 * nonsense ("at 7 75", "13 pm") so the caller can bail out rather than guess.
 */
const TIME_PATTERNS: { re: RegExp; hour: (m: RegExpMatchArray) => number | null }[] = [
  {
    // "at half past five", "quarter to 6"
    re: new RegExp(String.raw`\b(?:at\s+)?(half|quarter)\s+(past|to)\s+(\d{1,2})${MER}?`, "i"),
    hour: (m) => {
      const offset = m[1]!.toLowerCase() === "half" ? 30 : 15;
      const minutes = m[2]!.toLowerCase() === "past" ? offset : -offset;
      const h = clock(Number(m[3]), 0, m[4]);
      return h === null ? null : wrap(h + minutes / 60);
    },
  },
  {
    // "at 5:30 pm", "at 17.00", "2:30pm"
    re: new RegExp(String.raw`\b(?:at\s+)?(\d{1,2})[:.](${MINUTE})${MER}?`, "i"),
    hour: (m) => clock(Number(m[1]), Number(m[2]), m[3]),
  },
  {
    // "at 2 30 p.m." - how speech-to-text writes "two thirty". Needs "at" or an
    // am/pm to be a time at all, so "take 2 tablets" is never read as 2 o'clock.
    re: new RegExp(String.raw`\bat\s+(\d{1,2})\s+(${MINUTE})${MER}?`, "i"),
    hour: (m) => clock(Number(m[1]), Number(m[2]), m[3]),
  },
  {
    re: new RegExp(String.raw`\b(\d{1,2})\s+(${MINUTE})${MER}`, "i"),
    hour: (m) => clock(Number(m[1]), Number(m[2]), m[3]),
  },
  {
    // "at 5 o'clock"
    re: /\b(?:at\s+)?(\d{1,2})\s*o'?\s?clock(?:\s*(a\.?\s?m\.?|p\.?\s?m\.?))?/i,
    hour: (m) => clock(Number(m[1]), 0, m[2]),
  },
  {
    // "at 5pm", "5 p.m."
    re: new RegExp(String.raw`\b(?:at\s+)?(\d{1,2})${MER}`, "i"),
    hour: (m) => clock(Number(m[1]), 0, m[2]),
  },
  {
    // "in the morning", "after lunch", "at night"
    re: /\b(?:in\s+the|at|after|before|around|by|during)\s+(midnight|breakfast|morning|noon|midday|lunch|afternoon|teatime|evening|dinner|supper|night|bedtime)\b/i,
    hour: (m) => NAMED_HOURS[m[1]!.toLowerCase()] ?? null,
  },
  {
    // bare "at 5" - last resort, so every richer form above wins first. The
    // lookahead keeps "at 7 75" from being read as 7 o'clock with "75" left in
    // the label; it falls through to the nonsense check below instead.
    re: /\bat\s+(\d{1,2})\b(?!\s*[:.]?\s*\d)/i,
    hour: (m) => clock(Number(m[1]), 0, undefined),
  },
];

const wrap = (hour: number) => ((hour % 24) + 24) % 24;

/*
 * A bare hour with no am/pm: a care routine runs on waking hours, so 1-6 reads
 * as the afternoon ("at 5" is 5 in the evening, not 5 at dawn) and 7-12 as
 * written. 13-23 are already unambiguous.
 */
const assumeDaytime = (h: number) => (h >= 1 && h <= 6 ? h + 12 : h);

function clock(hour: number, minute: number, meridiem?: string): number | null {
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (meridiem) {
    const pm = meridiem.toLowerCase().replace(/[^ap]/g, "").startsWith("p");
    if (hour > 12 || hour < 1) return null; // "13 pm" / "0 am" are not things people say
    const h = hour === 12 ? (pm ? 12 : 0) : pm ? hour + 12 : hour;
    return h + minute / 60;
  }
  if (hour > 23) return null;
  return assumeDaytime(hour) + minute / 60;
}

/* Default when someone says "remind me to drink water" with no time at all. */
const DEFAULT_HOUR = 9;

export function parseAddReminder(text: string): ParsedReminder | null {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return null;

  const low = clean.toLowerCase();
  if (READ_ONLY.test(low)) return null;

  // Repair the "at" that speech-to-text heard as "add"/"and" before looking for
  // a command, so "reminder add 2.30 PM" still yields a time.
  const heard = clean.replace(HEARD_AS_AT, "at ");

  // "add a reminder ..." puts the task after the noun; "add water reminder ..."
  // puts it before. Try the plain form first, then the noun-last form.
  const command = heard.match(CREATE);
  const nounLast = command ? null : heard.match(CREATE_NOUN_LAST);
  if (!command && !nounLast) return null;

  const matched = (command ?? nounLast)!;
  // A label lifted from between the verb and the noun ("water" in "add water reminder").
  const seed = nounLast ? nounLast[1]!.trim() : "";

  // Drop the command, then lift the time out of whatever is left. The label is
  // the remainder, so word order does not matter: "add a reminder at 2 30 pm to
  // drink" and "remind me to drink at 2 30 pm" both land on "drink".
  let rest = heard.slice(matched[0].length);

  let hour: number | null = null;
  for (const { re, hour: read } of TIME_PATTERNS) {
    const found = rest.match(re);
    if (!found) continue;
    const parsed = read(found);
    if (parsed === null) return null; // a time was meant but makes no sense - do not guess
    hour = wrap(parsed);
    rest = `${rest.slice(0, found.index)} ${rest.slice(found.index! + found[0].length)}`;
    break;
  }

  // "at 7 75" - a time was clearly meant but none of the patterns could read it.
  // Better to ask again than to file the reminder at an hour nobody asked for.
  if (hour === null && /\bat\s+\d/i.test(rest)) return null;

  const tidy = (text: string) =>
    text
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[,;:.\-\s]+|[,;:.\-\s]+$/g, "")
      .replace(CONNECTIVES, "")
      .replace(TRAILING, "")
      .replace(/[.\s]+$/, "")
      .trim()
      .slice(0, 120)
      .trim();

  // What followed the command wins; the seed is the fallback for "add water reminder".
  const label = tidy(rest) || tidy(seed);

  if (!label) return null; // "remind me at 5" carries no task - ask again rather than invent one

  return { label, hour: hour ?? DEFAULT_HOUR };
}
