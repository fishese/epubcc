// Same chapter mark the novel exporter writes between TXT chapters:
// thirty HORIZONTAL ELLIPSIS characters (U+2026), then the title on the next line.
export const CHAPTER_SEPARATOR = "\u2026".repeat(30);

const NUMBER = "[0-9０-９零〇一二三四五六七八九十百千万兩两]+";
const UNIT = "章回节節卷部集篇话話幕";
const HEADING = new RegExp(
  `^(?:【|（|\\()?第${NUMBER}[${UNIT}][^。！？\\n]{0,24}(?:】|）|\\))?$`,
);

export function splitChapters(text, fallbackTitle, mode = "auto") {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const marker = new RegExp(`^${CHAPTER_SEPARATOR}[ \\t]*\\n([^\\n]+)\\n`, "gm");
  const names = [];
  const bodies = [];
  let bodyStart = -1;
  let chapter = null;
  let match;
  while ((match = marker.exec(normalized))) {
    if (chapter == null) {
      const preface = normalized.slice(0, match.index).trim();
      if (preface) {
        names.push("前言");
        bodies.push(preface);
      }
    } else {
      names.push(chapter);
      bodies.push(normalized.slice(bodyStart, match.index).trim());
    }
    chapter = match[1].trim();
    bodyStart = match.index + match[0].length;
  }
  if (chapter == null) {
    if (mode === "ellipsis") return [{ title: fallbackTitle || "正文", body: normalized.trim() }];
    return splitHeadings(normalized, fallbackTitle);
  }
  if (mode === "heading") return splitHeadings(normalized, fallbackTitle);
  names.push(chapter);
  bodies.push(normalized.slice(bodyStart).trim());
  return keepChaptersWithText(names.map((title, i) => ({ title, body: bodies[i] })));
}

// A separator entry with no body is a contents-list line. Keep the line in the
// previous section. A chapter with even one line of text stays, however short.
function keepChaptersWithText(chapters) {
  const kept = [];
  for (const chapter of chapters) {
    if (chapter.body.trim()) {
      kept.push(chapter);
      continue;
    }
    if (!kept.length) kept.push({ title: "前言", body: chapter.title });
    else kept[kept.length - 1].body = `${kept[kept.length - 1].body}\n${chapter.title}`.trim();
  }
  return kept;
}

function isHeading(line) {
  return line.length > 0 && line.length <= 40 && HEADING.test(line);
}

function hasTextBeforeNextHeading(lines, index) {
  for (let i = index + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    return !isHeading(trimmed);
  }
  return false;
}

function splitHeadings(text, fallbackTitle) {
  const lines = text.split("\n");
  const chapters = [];
  let title = null;
  let buf = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (title == null && !body) return;
    chapters.push({ title: title || fallbackTitle || "正文", body });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Chapter after chapter, with nothing between them, is a list. A heading
    // that has any text before the next heading is a real chapter.
    if (isHeading(trimmed) && !hasTextBeforeNextHeading(lines, i)) {
      buf.push(lines[i]);
      continue;
    }
    if (isHeading(trimmed)) {
      flush();
      title = trimmed;
      continue;
    }
    buf.push(lines[i]);
  }
  flush();
  if (chapters.length === 0) chapters.push({ title: fallbackTitle || "正文", body: text.trim() });
  return chapters;
}
