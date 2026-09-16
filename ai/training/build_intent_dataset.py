"""Build the talk-companion intent dataset.

Sources, recorded per sample in the output so nothing is anonymous:

  * ``app:<key>:<lang>`` - Mmry's own UI strings in every language they exist
    (the suggestion chips, the conversation options, task and screen labels).
  * ``keyword`` - the keyword lists the original app matched on.
  * ``template`` - short hand-written requests in English, Hindi and
    Hinglish, including the negatives a keyword matcher gets wrong
    ("play some music" is not a request for a game).

This is a small, curated dataset, not recorded patient speech. The metrics in
models/intent_metrics.json describe performance on it and nothing more.

    python -m training.build_intent_dataset --locales ../frontend/lib/i18n/locales
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "data" / "intent_phrases.json"

# UI strings whose meaning is one intent, in whatever language they appear.
APP_KEYS: dict[str, list[str]] = {
    "med": ["chipMed", "cvMed", "task_med_am", "task_med_pm"],
    "today": ["chipToday", "cvToday", "dayTitle"],
    "game": ["chipGame", "cvYes", "navGames", "activities"],
    "check": ["chipCheck", "cvCheck", "checkTitle", "checkStart"],
    "people": ["chipPeople", "cvPeople", "people", "navPpl"],
    "unknown": ["cvGood", "cvOk", "cvTired", "cvNo", "cvNothing", "cvStartOver", "cvMood"],
}

KEYWORDS: dict[str, list[str]] = {
    "med": ["medicine", "medication", "tablet", "dawa", "davaa", "दवा", "दवाई", "ওষুধ", "మందు", "ಔಷಧಿ", "മരുന്ന്", "மாத்திரை", "دوا"],
    "today": ["today", "schedule", "routine", "aaj", "आज", "दिनचर्या", "আজ", "இன்று", "నేడు", "ಇಂದು", "ഇന്ന്", "آج"],
    "who": ["who is", "who's", "kaun", "कौन", "কে", "யார்", "ఎవరు", "ಯಾರು", "ആരാണ്", "کون"],
    "game": ["game", "play", "khel", "खेल", "খেল", "ஆட்டம்", "ఆట", "ಆಟ", "കളി", "کھیل"],
    "check": ["mind check", "question", "sawal", "सवाल", "प्रश्न", "প্রশ্ন", "கேள்வி", "ప్రశ్న", "ಪ್ರಶ್ನೆ", "ചോദ്യം", "سوال"],
    "people": ["family", "people", "parivar", "परिवार", "পরিবার", "குடும்பம்", "కుటుంబం", "ಕುಟುಂಬ", "കുടുംബം", "خاندان"],
}

NAMES = ["Bishnu", "Rupa", "Mina", "Dr. Sharma", "बिष्णु", "रूपा", "मीना", "বিষ্ণু", "রূপা"]

TEMPLATES: dict[str, list[str]] = {
    "med": [
        "when do I take my medicine", "did I take my tablets", "is it time for my pills", "what medicine do I take",
        "medicine time", "I need my tablet", "remind me about my medicine", "which tablet now",
        "दवा कब लेनी है", "मेरी गोली का समय", "क्या मैंने दवा ली", "dawa kab leni hai", "goli ka time ho gaya",
        "ওষুধ কখন খাব", "ঔষধ কেতিয়া খাম",
    ],
    "today": [
        "what is my plan today", "what do I do now", "what is left for today", "what is next",
        "what should I do this morning", "tell me my day", "anything to do today",
        "आज क्या करना है", "अब क्या करूँ", "आज का काम", "aaj kya karna hai", "ab kya karna hai",
        "আজ কী করতে হবে", "আজি কি কৰিব লাগে",
    ],
    "who": [
        "who is {name}", "tell me about {name}", "who is this person", "I forgot who {name} is",
        "{name} कौन है", "{name} kaun hai", "{name} কে", "{name} কোন",
    ],
    "game": [
        "let us play", "I want to play a game", "start a game", "play the memory cards", "can we play something",
        "खेलते हैं", "कोई खेल खेलें", "khel khelna hai", "khelte hain", "খেলা শুরু করো", "খেল খেলোঁ",
    ],
    "check": [
        "ask me some questions", "test my memory", "do the mind check", "start the questions", "check my memory",
        "मुझसे सवाल पूछो", "याददाश्त जाँचो", "sawal pucho", "memory check karo", "আমাকে প্রশ্ন করো",
    ],
    "people": [
        "show my family", "who are my people", "show me my people", "I want to see my family",
        "open my family", "मेरे परिवार को दिखाओ", "मेरे अपने", "parivar dikhao", "apne log dikhao", "আমার পরিবার দেখাও",
    ],
    "unknown": [
        "hello", "good morning", "thank you", "namaste", "नमस्ते", "धन्यवाद", "I am hungry", "it is cold today",
        "open the window", "play some music", "switch on the fan", "what is the weather", "I want to sleep",
        "where is my spectacles", "call the taxi", "sing a song", "how are you", "मुझे भूख लगी है",
        "गाना बजाओ", "पंखा चलाओ", "khana kab milega", "ভালো আছি", "মই ভালে আছোঁ", "yes", "no", "okay",
    ],
}


def build(locales: Path) -> list[dict[str, str]]:
    tables = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(locales.glob("*.json"))}
    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def add(text: str, intent: str, source: str) -> None:
        key = (text.strip().lower(), intent)
        if text.strip() and key not in seen:
            seen.add(key)
            rows.append({"text": text.strip(), "intent": intent, "source": source})

    for intent, keys in APP_KEYS.items():
        for lang, table in tables.items():
            for k in keys:
                if k in table:
                    add(table[k], intent, f"app:{k}:{lang}")
    for intent, words in KEYWORDS.items():
        for w in words:
            add(w, intent, "keyword")
    for intent, phrases in TEMPLATES.items():
        for phrase in phrases:
            if "{name}" in phrase:
                for name in NAMES:
                    add(phrase.format(name=name), intent, "template")
            else:
                add(phrase, intent, "template")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--locales", type=Path, default=HERE.parents[1] / "frontend" / "lib" / "i18n" / "locales")
    args = parser.parse_args()
    rows = build(args.locales)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"samples": rows}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["intent"]] = counts.get(r["intent"], 0) + 1
    print(f"wrote {len(rows)} samples to {OUT}: {counts}")


if __name__ == "__main__":
    main()
