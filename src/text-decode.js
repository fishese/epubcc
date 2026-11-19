const CJK_MIN = 0x4e00;
const CJK_MAX = 0x9fff;

export function decodeText(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xfe && data[2] === 0x00 && data[3] === 0x00) {
    return decodeUtf32(data, true);
  }
  if (data.length >= 4 && data[0] === 0x00 && data[1] === 0x00 && data[2] === 0xfe && data[3] === 0xff) {
    return decodeUtf32(data, false);
  }
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(data);
  }
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(data);
  }
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(data);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    const utf16 = utf16WithoutBom(data);
    if (utf16) return utf16;
    return decodeChineseLegacy(data);
  }
}

function decodeUtf32(data, littleEndian) {
  const chars = [];
  for (let i = 4; i + 3 < data.length; i += 4) {
    const code = littleEndian
      ? data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)
      : (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
    if (code === 0xfeff || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) continue;
    chars.push(String.fromCodePoint(code));
  }
  return chars.join("");
}

function utf16WithoutBom(data) {
  if (data.length < 4 || data.length % 2 !== 0) return "";
  const le = pairRatio(data, true);
  const be = pairRatio(data, false);
  if (Math.max(le, be) < 0.8 || Math.abs(le - be) < 0.2) return "";
  return new TextDecoder(le > be ? "utf-16le" : "utf-16be").decode(data);
}

function pairRatio(data, littleEndian) {
  let good = 0;
  const pairs = data.length / 2;
  for (let i = 0; i < data.length; i += 2) {
    const low = littleEndian ? data[i] : data[i + 1];
    const high = littleEndian ? data[i + 1] : data[i];
    const code = low | (high << 8);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= CJK_MIN && code <= CJK_MAX) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      good++;
    }
  }
  return good / pairs;
}

function decodeChineseLegacy(data) {
  const gb = new TextDecoder("gb18030").decode(data);
  const big5 = new TextDecoder("big5").decode(data);
  return textScore(big5) > textScore(gb) ? big5 : gb;
}

function textScore(text) {
  let cjk = 0;
  let bad = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === 0xfffd || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)) bad++;
    else if (code >= CJK_MIN && code <= CJK_MAX) cjk++;
  }
  return cjk - bad * 5;
}
