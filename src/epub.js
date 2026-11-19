import JSZip from "jszip";
import { splitChapters } from "./chapters.js";
import { convertText } from "./convert.js";
import { horizontalPunct, verticalParts, verticalPunct, VERTICAL_CSS } from "./punct.js";

const SKIP = new Set(["script", "style", "code", "pre", "rt", "rp"]);

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyPunct(text, punct) {
  if (punct === "horizontal") return horizontalPunct(text);
  if (punct === "vertical") return verticalPunct(text);
  return text;
}

function transform(text, mode, punct) {
  return applyPunct(convertText(text, mode), punct);
}

function inlineHtml(text, punct) {
  const source = punct === "vertical" ? verticalParts(text) : [{ text }];
  return source
    .map((part) => {
      const html = escapeXml(part.text).replaceAll("\n", "<br/>");
      return part.upright ? `<span class="lat1">${html}</span>` : html;
    })
    .join("");
}

function paragraphs(body, punct) {
  const blocks = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (blocks.length === 0) return "<p></p>";
  return blocks.map((block) => `<p>${inlineHtml(block, punct)}</p>`).join("\n");
}

function page(title, bodyHtml, punct) {
  const css = punct === "vertical" ? `<style type="text/css">${VERTICAL_CSS}</style>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-Hant" lang="zh-Hant">
<head><title>${escapeXml(title)}</title>${css}</head>
<body>
<h1>${inlineHtml(title, punct)}</h1>
${bodyHtml}
</body>
</html>`;
}

export async function txtToEpub(filename, bytes, options) {
  const text = decodeText(bytes);
  const title = filename.replace(/\.txt$/i, "") || "未命名";
  const chapters = splitChapters(text, title, options.chapters || "auto").map((chapter) => ({
    title: transform(chapter.title, options.mode, options.punct),
    html: paragraphs(transform(chapter.body, options.mode, options.punct), options.punct),
  }));
  return packEpub(transform(title, options.mode, options.punct), chapters, options.punct);
}

export async function epubToEpub(bytes, options) {
  const zip = await JSZip.loadAsync(bytes);
  if (zip.file("META-INF/encryption.xml")) throw new Error("加密的 EPUB 不能轉換");
  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("不是 EPUB");
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("找不到 OPF");
  const opf = await zip.file(opfPath)?.async("string");
  if (!opf) throw new Error("找不到 OPF");
  const doc = new DOMParser().parseFromString(opf, "application/xml");
  const manifest = new Map();
  for (const item of doc.getElementsByTagName("item")) {
    manifest.set(item.getAttribute("id"), item.getAttribute("href"));
  }
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  for (const ref of doc.getElementsByTagName("itemref")) {
    const href = manifest.get(ref.getAttribute("idref"));
    if (!href) continue;
    const path = decodeURI(base + href.split("#")[0]);
    const file = zip.file(path);
    if (!file) continue;
    const html = await file.async("string");
    zip.file(path, convertHtml(html, options));
  }
  if (options.punct === "vertical") {
    for (const spine of doc.getElementsByTagName("spine")) {
      spine.setAttribute("page-progression-direction", "rtl");
    }
  }
  for (const el of doc.getElementsByTagName("dc:language")) el.textContent = "zh-Hant";
  for (const tag of ["dc:title", "dc:creator", "dc:description"]) {
    for (const el of doc.getElementsByTagName(tag)) {
      el.textContent = transform(el.textContent, options.mode, options.punct);
    }
  }
  zip.file(opfPath, new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    mimeType: "application/epub+zip",
  });
}

function convertHtml(html, options) {
  const doc = new DOMParser().parseFromString(html, "application/xhtml+xml");
  const root = doc.querySelector("parsererror") ? new DOMParser().parseFromString(html, "text/html") : doc;
  walk(root.body || root.documentElement, options);
  if (options.punct === "vertical") {
    const head = root.querySelector("head") || root.documentElement;
    const style = root.createElement("style");
    style.setAttribute("type", "text/css");
    style.textContent = VERTICAL_CSS;
    head.appendChild(style);
  }
  const htmlEl = root.documentElement;
  if (htmlEl) {
    htmlEl.setAttribute("lang", "zh-Hant");
    htmlEl.setAttribute("xml:lang", "zh-Hant");
  }
  return new XMLSerializer().serializeToString(root);
}

function walk(node, options) {
  if (!node) return;
  if (node.nodeType === 1 && SKIP.has(node.localName)) return;
  if (node.nodeType === 3) {
    const value = transform(node.nodeValue, options.mode, options.punct);
    if (options.punct !== "vertical") {
      node.nodeValue = value;
      return;
    }
    const parent = node.parentNode;
    const frag = node.ownerDocument.createDocumentFragment();
    for (const part of verticalParts(value)) {
      const text = node.ownerDocument.createTextNode(part.text);
      if (!part.upright) {
        frag.appendChild(text);
        continue;
      }
      const span = node.ownerDocument.createElementNS(parent.namespaceURI || "http://www.w3.org/1999/xhtml", "span");
      span.setAttribute("class", "lat1");
      span.appendChild(text);
      frag.appendChild(span);
    }
    parent.replaceChild(frag, node);
    return;
  }
  for (const child of [...node.childNodes]) walk(child, options);
}

function decodeText(bytes) {
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  try {
    return utf8.decode(bytes);
  } catch {
    return new TextDecoder("gb18030").decode(bytes);
  }
}

async function packEpub(title, chapters, punct) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  const manifest = [`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`];
  const spine = [];
  const navItems = [];
  chapters.forEach((chapter, index) => {
    const id = `c${index + 1}`;
    const href = `${id}.xhtml`;
    zip.file(`OEBPS/${href}`, page(chapter.title, chapter.html, punct));
    manifest.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
    navItems.push(`<li><a href="${href}">${inlineHtml(chapter.title, punct)}</a></li>`);
  });
  zip.file(
    "OEBPS/nav.xhtml",
    page("目錄", `<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>${navItems.join("")}</ol></nav>`, punct),
  );
  spine.unshift(`<itemref idref="nav"/>`);
  const progression = punct === "vertical" ? ` page-progression-direction="rtl"` : "";
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="3.0" xml:lang="zh-Hant">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier>
<dc:title>${escapeXml(title)}</dc:title>
<dc:language>zh-Hant</dc:language>
</metadata>
<manifest>${manifest.join("")}</manifest>
<spine${progression}>${spine.join("")}</spine>
</package>`,
  );
  return zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
}
