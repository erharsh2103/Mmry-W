"""Local speech-to-text using faster-whisper.

Tuned for one job: short commands spoken by an older person, often in a room
with a television or family talking nearby. That shapes every choice here -
a wider beam, a domain prompt so "at 2:30" is not heard as "add 2:30", VAD
settings that tolerate slow speech, and thresholds that return nothing rather
than hallucinate a sentence out of background noise.
"""

from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

from faster_whisper import WhisperModel

# Whisper speaks ISO-639-1. The app ships locales it has never heard of, so map
# the ones with a real equivalent and let it auto-detect the rest - a wrong
# forced language garbles the transcript far worse than detection does.
WHISPER_LANGS = {
    "as", "bn", "en", "gu", "hi", "kn", "ml", "mr", "ne", "pa", "sa", "sd", "ta", "te", "ur",
}
LANG_ALIASES = {
    "asm": "as", "ben": "bn", "eng": "en", "guj": "gu", "hin": "hi", "kan": "kn",
    "mal": "ml", "mar": "mr", "nep": "ne", "pan": "pa", "san": "sa", "snd": "sd",
    "tam": "ta", "tel": "te", "urd": "ur",
}

# Biases the decoder toward the words this assistant actually hears. Without it
# "remind me ... at 2:30" is routinely transcribed "... add 2:30", because "add"
# is the likelier word after "reminder" in Whisper's general training data.
ENGLISH_PROMPT = (
    "Voice commands for a daily reminder app. Examples: "
    "Remind me to take my medicine at 5 pm. "
    "Add a reminder to drink water at 9:30 am. "
    "Set a reminder for lunch at 1 o'clock. "
    "What are my reminders today? "
    "Words used often: reminder, medicine, tablets, water, walk, doctor, "
    "breakfast, lunch, dinner, morning, afternoon, evening, night, o'clock, am, pm."
)


def normalise_language(lang: str) -> str | None:
    """Return a Whisper language code, or None to let it auto-detect."""
    code = (lang or "").strip().lower().replace("_", "-").split("-")[0]
    code = LANG_ALIASES.get(code, code)
    return code if code in WHISPER_LANGS else None


class Transcriber:
    name = "faster-whisper"

    def __init__(self, model_name: str, device: str, compute_type: str, beam_size: int = 5):
        self.model_name = model_name
        self.version = model_name
        self.beam_size = max(1, beam_size)
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)

    def transcribe(self, audio: bytes, suffix: str, language: str) -> tuple[str, float]:
        code = normalise_language(language)
        with NamedTemporaryFile(suffix=suffix, delete=False) as file:
            file.write(audio)
            path = Path(file.name)
        try:
            segments, info = self.model.transcribe(
                str(path),
                language=code,
                beam_size=self.beam_size,
                # Retry hotter only if the greedy pass looks degenerate; keeps the
                # common case deterministic while rescuing the occasional garble.
                temperature=[0.0, 0.2, 0.4, 0.6],
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                # Background chatter that is not speech should come back empty.
                no_speech_threshold=0.6,
                condition_on_previous_text=False,
                initial_prompt=ENGLISH_PROMPT if code == "en" else None,
                vad_filter=True,
                vad_parameters={
                    # An older speaker pauses mid-sentence; do not cut the clip into
                    # fragments at the first half-second of quiet.
                    "min_silence_duration_ms": 700,
                    "speech_pad_ms": 300,
                    "min_speech_duration_ms": 150,
                    "threshold": 0.45,
                },
            )
            collected = list(segments)
            text = " ".join(segment.text.strip() for segment in collected).strip()
            return text, self._confidence(collected, info)
        finally:
            path.unlink(missing_ok=True)

    @staticmethod
    def _confidence(segments: list, info) -> float:
        """Duration-weighted, so one clipped word cannot sink an otherwise clean clip."""
        if not segments:
            return 0.0
        total = sum(max(segment.end - segment.start, 0.01) for segment in segments)
        weighted = sum(segment.avg_logprob * max(segment.end - segment.start, 0.01) for segment in segments)
        score = 1.0 + (weighted / total) / 5.0
        # A high no-speech probability means the model was mostly guessing at noise.
        no_speech = max((getattr(segment, "no_speech_prob", 0.0) for segment in segments), default=0.0)
        if no_speech > 0.5:
            score *= 1.0 - min(no_speech, 0.95)
        language_probability = getattr(info, "language_probability", None)
        if language_probability:
            score *= 0.5 + 0.5 * language_probability
        return max(0.0, min(1.0, score))
