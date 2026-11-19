import * as OpenCC from "opencc-js";

const CONVERTERS = {
  tw: OpenCC.Converter({ from: "cn", to: "tw" }),
  t: OpenCC.Converter({ from: "cn", to: "t" }),
  hk: OpenCC.Converter({ from: "cn", to: "hk" }),
};

export function convertText(text, mode) {
  const convert = CONVERTERS[mode] || CONVERTERS.t;
  return convert(text);
}

export function downloadName(filename, mode) {
  const base = filename.replace(/\.(txt|epub)$/i, "");
  const converted = convertText(base, mode)
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${converted || "book"}.epub`;
}
