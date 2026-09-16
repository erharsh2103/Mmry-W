"""Text normalisation shared by intent training and inference.

Training and serving must see identical text, so both import this module.
"""

from __future__ import annotations

import re
import unicodedata

_PUNCT = re.compile(r"[।॥?!.,;:\"'()\[\]{}\-–—…।॥]+")
_SPACE = re.compile(r"\s+")


def normalise(text: str) -> str:
    """NFKC, lower-case, strip punctuation (including Indic danda), collapse spaces."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = _PUNCT.sub(" ", text)
    return _SPACE.sub(" ", text).strip()
