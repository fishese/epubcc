const URL = /https?:\/\/[^\s<>"']+/g;

function protect(text, fn) {
  const saved = [];
  const masked = text.replace(URL, (url) => {
    saved.push(url);
    return `\u0000${saved.length - 1}\u0000`;
  });
  const result = fn(masked);
  if (typeof result === "string") return result.replace(/\u0000(\d+)\u0000/g, (_, i) => saved[Number(i)]);
  return result.map((part) => ({ ...part, text: part.text.replace(/\u0000(\d+)\u0000/g, (_, i) => saved[Number(i)]) }));
}

function paired(text, open, close, left, right) {
  const pattern = new RegExp(`${open}([^${open}${close}\\r\\n]+)${close}`, "g");
  return text.replace(pattern, `${left}$1${right}`);
}

/** Taiwan quotes: outer 「」, inner 『』. ASCII pairs on one line follow the same order. */
export function horizontalPunct(text) {
  return protect(text, (value) => {
    let out = value.replaceAll("“", "「").replaceAll("”", "」");
    out = out.replaceAll("‘", "『").replaceAll("’", "』");
    out = paired(out, '"', '"', "「", "」");
    out = paired(out, "'", "'", "『", "』");
    return out;
  });
}

/**
 * Vertical forms sit in the center of the em box (CLReq Taiwan / vertical
 * presentation forms). Quotes use the vertical forms of 「」 and 『』.
 */
export function verticalPunct(text) {
  return protect(horizontalPunct(text), (value) => {
    return value
      .replaceAll("「", "﹁")
      .replaceAll("」", "﹂")
      .replaceAll("『", "﹃")
      .replaceAll("』", "﹄")
      .replaceAll("——", "︱︱")
      .replaceAll("—", "︱")
      .replaceAll("……", "︙")
      .replaceAll("…", "︙")
      .replaceAll("，", "︐")
      .replaceAll("。", "︒")
      .replaceAll("、", "︑")
      .replaceAll("！", "︕")
      .replaceAll("？", "︖")
      .replaceAll("：", "︓")
      .replaceAll("；", "︔");
  });
}

const LATIN_WORD = /[A-Za-z\uFF21-\uFF3A\uFF41-\uFF5A]+(?:['’\-][A-Za-z\uFF21-\uFF3A\uFF41-\uFF5A]+)*/g;

function letterCount(word) {
  return [...word.replace(/['’\-]/g, "")].length;
}

/** One Latin letter stays upright; a word of two or more stays in the sideways run. */
export function verticalParts(text) {
  return protect(text, (value) => {
    const parts = [];
    let last = 0;
    for (const match of value.matchAll(LATIN_WORD)) {
      if (match.index > last) parts.push({ text: value.slice(last, match.index) });
      const word = match[0];
      parts.push(letterCount(word) === 1 ? { text: word, upright: true } : { text: word });
      last = match.index + match[0].length;
    }
    if (last < value.length) parts.push({ text: value.slice(last) });
    return parts;
  });
}

export const VERTICAL_CSS = `html,body{writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl;-epub-writing-mode:vertical-rl;text-orientation:mixed;font-feature-settings:"vert" 1,"vrt2" 1}.lat1{text-orientation:upright;-webkit-text-orientation:upright}p{margin:0 1em}h1{font-weight:normal;text-align:start}`;
