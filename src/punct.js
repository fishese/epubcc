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

const DIGIT = "[0-9\\uFF10-\\uFF19]";
const GROUPED_NUMBER = `${DIGIT}{1,3}(?:[,，\\uFE10]${DIGIT}{1,3})+`;
const LATIN = "[A-Za-z\\uFF21-\\uFF3A\\uFF41-\\uFF5A]";
const TOKEN = new RegExp(`${GROUPED_NUMBER}|${DIGIT}+|${LATIN}+(?:['’\\-]${LATIN}+)*`, "g");

function letterCount(word) {
  return [...word.replace(/['’\-]/g, "")].length;
}

function digitCount(token) {
  return [...token.replace(/[^0-9\uFF10-\uFF19]/g, "")].length;
}

function staysUpright(token) {
  if (/[A-Za-z\uFF21-\uFF3A\uFF41-\uFF5A]/.test(token)) return letterCount(token) === 1;
  if (/[,，\uFE10]/.test(token)) return false;
  const digits = digitCount(token);
  return digits >= 1 && digits <= 3;
}

/** One Latin letter, or a number of 1–3 digits, stays upright. Longer words and numbers go sideways. */
export function verticalParts(text) {
  return protect(text, (value) => {
    const parts = [];
    let last = 0;
    for (const match of value.matchAll(TOKEN)) {
      if (match.index > last) parts.push({ text: value.slice(last, match.index) });
      const token = match[0];
      parts.push(staysUpright(token) ? { text: token, upright: true } : { text: token });
      last = match.index + token.length;
    }
    if (last < value.length) parts.push({ text: value.slice(last) });
    return parts;
  });
}

export const VERTICAL_CSS = `html,body{writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl;-epub-writing-mode:vertical-rl;text-orientation:mixed;font-feature-settings:"vert" 1,"vrt2" 1}.lat1{text-orientation:upright;-webkit-text-orientation:upright}p{margin:0 1em}h1{font-weight:normal;text-align:start}`;
