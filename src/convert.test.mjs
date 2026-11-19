import assert from "node:assert/strict";
import test from "node:test";
import { CHAPTER_SEPARATOR, splitChapters } from "./chapters.js";
import { convertText, downloadName } from "./convert.js";
import { horizontalPunct, verticalParts, verticalPunct } from "./punct.js";

test("default traditional keeps phrasing", () => {
  const out = convertText("后来王后说后来", "t");
  assert.equal(out, "後來王后說後來");
  assert.equal(downloadName("后来王后.txt", "t"), "後來王后.epub");
  assert.equal(downloadName("Notes.epub", "t"), "Notes.epub");
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
