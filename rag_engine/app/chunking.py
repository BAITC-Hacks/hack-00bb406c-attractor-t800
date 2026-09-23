import re


def split_text(text: str, *, max_words: int = 70, overlap: int = 12) -> list[tuple[str, str]]:
    """Return (section path, body) pairs. Short passages avoid model truncation."""
    sections: list[tuple[str, list[str]]] = []
    heading = ""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            heading = line.lstrip("# ").strip()
            continue
        sections.append((heading, re.findall(r"\S+", line)))

    if not sections and text.strip():
        sections = [("", re.findall(r"\S+", text))]

    result: list[tuple[str, str]] = []
    current: list[str] = []
    current_heading = ""
    for section_heading, words in sections:
        if current and section_heading != current_heading:
            result.append((current_heading, " ".join(current)))
            current = []
        current_heading = section_heading
        while words:
            space = max_words - len(current)
            current.extend(words[:space])
            words = words[space:]
            if len(current) >= max_words:
                result.append((current_heading, " ".join(current)))
                current = current[-overlap:] if words else []
        if len(current) >= max_words:
            result.append((current_heading, " ".join(current)))
            current = []
    if current:
        result.append((current_heading, " ".join(current)))
    return result
