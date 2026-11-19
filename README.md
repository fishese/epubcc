# epubcc

Browser tool that converts TXT and EPUB files to Traditional Chinese EPUBs. Conversion runs in the browser. Files are not uploaded.

Phrase conversion uses [OpenCC](https://github.com/BYVoid/OpenCC), so 后来 becomes 後來 and 王后 stays 王后.

TXT input may be UTF-8, UTF-16, or UTF-32, with or without a byte-order mark. GB2312, GBK, and GB18030 are read as GB18030. Big5 is detected when the bytes are not valid UTF-8.

## TXT chapters

- A line of thirty ellipsis characters (`…`), with the chapter title on the next line.
- Or a line of its own beginning with 第…章, 回, 節, 卷, 部, 集, 篇, 話, or 幕.

## Run locally

```sh
npm install
npm test
npm run dev
```

## Site

Published with GitHub Pages from the `main` branch build.
