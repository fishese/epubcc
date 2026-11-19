import * as OpenCC from "opencc-js";

const CONVERTERS = {
  tw: OpenCC.Converter({ from: "cn", to: "tw" }),
  t: OpenCC.Converter({ from: "cn", to: "t" }),
  hk: OpenCC.Converter({ from: "cn", to: "hk" }),
};

export function convertText(text, mode) {
  const convert = CONVERTERS[mode] || CONVERTERS.tw;
  return convert(text);
}
