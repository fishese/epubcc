import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { CHAPTER_SEPARATOR, splitChapters } from "./chapters.js";
import { convertText, downloadName } from "./convert.js";
import { decodeText } from "./text-decode.js";
import { txtToEpub } from "./epub.js";
import { horizontalPunct, verticalParts, verticalPunct } from "./punct.js";

test("default traditional keeps phrasing", () => {
  const out = convertText("后来王后说后来", "t");
  assert.equal(out, "後來王后說後來");
  assert.equal(downloadName("后来王后.txt", "t"), "後來王后.epub");
  assert.equal(downloadName("Notes.epub", "t"), "Notes.epub");
});

test("utf-16 text is not misread before conversion", () => {
  const encoded = new Uint8Array(Buffer.from("\uFEFF后来王后", "utf16le"));
  assert.equal(decodeText(encoded), "后来王后");
  assert.equal(convertText(decodeText(encoded), "t"), "後來王后");
});

test("other unicode and common Chinese encodings decode", () => {
  assert.equal(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, 0xe5, 0x90, 0x8e, 0xe6, 0x9d, 0xa5])), "后来");
  assert.equal(decodeText(Uint8Array.from([0xfe, 0xff, 0x54, 0x0e, 0x67, 0x65])), "后来");
  assert.equal(decodeText(Uint8Array.from([0x0e, 0x54, 0x65, 0x67, 0x8b, 0x73])), "后来王");
  assert.equal(
    decodeText(Uint8Array.from([0xff, 0xfe, 0x00, 0x00, 0x0e, 0x54, 0x00, 0x00, 0x65, 0x67, 0x00, 0x00])),
    "后来",
  );
  assert.equal(decodeText(Uint8Array.from([0xba, 0xf3, 0xc0, 0xb4, 0xcd, 0xf5, 0xba, 0xf3])), "后来王后");
  assert.equal(decodeText(Uint8Array.from([0xab, 0xe1, 0xa8, 0xd3, 0xa4, 0xfd, 0xa6, 0x5a])), "後來王后");
});

test("phrase conversion keeps 王后 and writes 後來", () => {
  const out = convertText("后来王后说后来", "tw");
  assert.equal(out, "後來王后說後來");
  assert.equal(out.includes("后來"), false);
  assert.equal(out.includes("王後"), false);
});

test("txt chapters follow the novel exporter ellipsis mark", () => {
  const title = "第一章 开始";
  const text = `前言\n\n${CHAPTER_SEPARATOR}\n${title}\n正文后来`;
  const chapters = splitChapters(text, "书");
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].title, "前言");
  assert.equal(chapters[1].title, title);
  assert.match(chapters[1].body, /后来/);
});

test("heading lines still become chapters when there is no ellipsis mark", () => {
  const chapters = splitChapters("介绍\n\n第一章 启程\n走了\n\n第二章 到了\n停", "书");
  assert.deepEqual(chapters.map((chapter) => chapter.title), ["书", "第一章 启程", "第二章 到了"]);
  assert.match(chapters[0].body, /介绍/);
});

test("heading mode accepts 回, 节, and 话", () => {
  const chapters = splitChapters("第1回 出发\n走\n\n第三节\n停\n\n第2話 終\n完", "书", "heading");
  assert.deepEqual(
    chapters.map((chapter) => chapter.title),
    ["第1回 出发", "第三节", "第2話 終"],
  );
});

test("ellipsis mode leaves 第章 lines inside the chapter", () => {
  const chapters = splitChapters("第一章 不被切开\n正文", "书", "ellipsis");
  assert.equal(chapters.length, 1);
  assert.match(chapters[0].body, /第一章/);
});

test("a chapter list with no text between entries is not a run of empty chapters", () => {
  const listed = ["第一章 启程", "第二章 山路", "第三章 客栈"].join("\n\n");
  const text = `${listed}\n\n第一章 启程\n走了\n\n第二章 山路\n停`;
  for (const mode of ["auto", "heading"]) {
    const chapters = splitChapters(text, "书", mode);
    assert.deepEqual(
      chapters.map((chapter) => chapter.title),
      ["书", "第一章 启程", "第二章 山路"],
      mode,
    );
    assert.match(chapters[0].body, /第三章 客栈/, mode);
    assert.match(chapters[1].body, /走了/, mode);
    assert.equal(chapters[2].body, "停", mode);
  }
});

test("separator mode keeps a contents list out of the chapter sequence", () => {
  const sep = CHAPTER_SEPARATOR;
  const text = [`序`, sep, "第一章 启程", "", sep, "第二章 山路", sep, "第一章 启程", "走了", sep, "第二章 山路", "停"].join("\n");
  for (const mode of ["auto", "ellipsis"]) {
    const chapters = splitChapters(text, "书", mode);
    assert.deepEqual(
      chapters.map((chapter) => chapter.title),
      ["前言", "第一章 启程", "第二章 山路"],
      mode,
    );
    assert.match(chapters[0].body, /序/, mode);
    assert.match(chapters[0].body, /第一章 启程/, mode);
    assert.match(chapters[0].body, /第二章 山路/, mode);
    assert.equal(chapters[1].body, "走了", mode);
    assert.equal(chapters[2].body, "停", mode);
  }
});

test("a bare chapter-number menu is not also the first page", async () => {
  const text = `序文在此\n\n1. 第 1 章：启程\n\n${CHAPTER_SEPARATOR}\n第 1 章\n正文\n\n${CHAPTER_SEPARATOR}\n第 2 章\n后文`;
  for (const chapters of ["ellipsis", "auto", "heading"]) {
    const epub = await txtToEpub("book.txt", Buffer.from(text), { mode: "t", punct: "none", chapters });
    const zip = await JSZip.loadAsync(epub);
    const opf = await zip.file("OEBPS/content.opf").async("string");
    assert.equal(opf.includes('idref="nav"'), false, chapters);
    const nav = await zip.file("OEBPS/nav.xhtml").async("string");
    assert.match(nav, /<nav /, chapters);
    const first = opf.match(/<itemref idref="([^"]+)"/)[1];
    const href = opf.match(new RegExp(`id="${first}" href="([^"]+)"`))[1];
    const html = await zip.file(`OEBPS/${href}`).async("string");
    assert.match(html, /序文在此/, chapters);
    assert.equal(html.includes("<nav "), false, chapters);
  }
});

test("vertical navigation labels stay plain chapter names", async () => {
  const text = `${CHAPTER_SEPARATOR}\n第 1 章\nA市正文\n\n${CHAPTER_SEPARATOR}\n第 12 章\n又来了`;
  const epub = await txtToEpub("book.txt", Buffer.from(text), { mode: "t", punct: "vertical", chapters: "ellipsis" });
  const zip = await JSZip.loadAsync(epub);
  const nav = await zip.file("OEBPS/nav.xhtml").async("string");
  const labels = [...nav.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["第 1 章", "第 12 章"]);
  const chapter = await zip.file("OEBPS/c1.xhtml").async("string");
  assert.match(chapter, /<span class="lat1">A<\/span>/);
});

test("horizontal and vertical quotes", () => {
  assert.equal(horizontalPunct("他说：“后来”"), "他說：「後來」".replace("他說", "他说").replace("後來", "后来"));
  assert.equal(horizontalPunct("他说：“后来”"), "他说：「后来」");
  assert.equal(verticalPunct("他说：“后来”。"), "他说︓﹁后来﹂︒");
});

test("a single Latin letter stays upright and a word stays sideways", () => {
  const parts = verticalParts("在Ａ市读Hello");
  assert.deepEqual(parts, [
    { text: "在" },
    { text: "Ａ", upright: true },
    { text: "市读" },
    { text: "Hello" },
  ]);
});

test("numbers of one to three digits stay upright and longer numbers go sideways", () => {
  assert.deepEqual(verticalParts("3天12月365日2008年1234567"), [
    { text: "3", upright: true },
    { text: "天" },
    { text: "12", upright: true },
    { text: "月" },
    { text: "365", upright: true },
    { text: "日" },
    { text: "2008" },
    { text: "年" },
    { text: "1234567" },
  ]);
  assert.deepEqual(verticalParts(verticalPunct("共1,234,567与1，234，567人")), [
    { text: "共" },
    { text: "1,234,567" },
    { text: "与" },
    { text: "1\uFE10234\uFE10567" },
    { text: "人" },
  ]);
});
