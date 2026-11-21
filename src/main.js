import JSZip from "jszip";
import { downloadName } from "./convert.js";
import { epubToEpub, txtToEpub } from "./epub.js";

const files = document.querySelector("#files");
const drop = document.querySelector("#drop");
const shield = document.querySelector("#drop-shield");
const go = document.querySelector("#go");
const list = document.querySelector("#list");
const zipButton = document.querySelector("#zip");
const results = [];
let dragHide = 0;

files.addEventListener("change", () => {
  go.disabled = files.files.length === 0;
});

function draggingFiles(event) {
  const types = event.dataTransfer?.types;
  return Boolean(types && Array.from(types).includes("Files"));
}

function showDropTarget() {
  window.clearTimeout(dragHide);
  drop.classList.add("hot");
  shield.hidden = false;
  dragHide = window.setTimeout(hideDropTarget, 500);
}

function hideDropTarget() {
  window.clearTimeout(dragHide);
  drop.classList.remove("hot");
  shield.hidden = true;
}

function droppedFiles(event) {
  const transfer = new DataTransfer();
  for (const file of event.dataTransfer.files) transfer.items.add(file);
  files.files = transfer.files;
  files.dispatchEvent(new Event("change"));
}

window.addEventListener("dragenter", (event) => {
  if (!draggingFiles(event)) return;
  event.preventDefault();
  showDropTarget();
}, true);

window.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (!draggingFiles(event)) return;
  showDropTarget();
  event.dataTransfer.dropEffect = "copy";
}, true);

window.addEventListener("drop", (event) => {
  event.preventDefault();
  const accept = draggingFiles(event) && event.dataTransfer.files.length > 0;
  hideDropTarget();
  if (accept) droppedFiles(event);
}, true);

window.addEventListener("dragend", hideDropTarget);

go.addEventListener("click", async () => {
  go.disabled = true;
  list.replaceChildren();
  results.length = 0;
  zipButton.hidden = true;
  const options = {
    mode: document.querySelector("#mode").value,
    punct: document.querySelector("#punct").value,
    chapters: document.querySelector("#chapters").value,
  };
  for (const file of files.files) {
    const item = document.createElement("li");
    item.textContent = `${file.name} …`;
    list.append(item);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const epub = file.name.toLowerCase().endsWith(".txt")
        ? await txtToEpub(file.name, bytes, options)
        : await epubToEpub(bytes, options);
      const name = downloadName(file.name, options.mode);
      const blob = new Blob([epub], { type: "application/epub+zip" });
      results.push({ name, blob });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.textContent = name;
      item.replaceChildren(link);
    } catch (error) {
      item.textContent = `${file.name}：${error.message || error}`;
      item.className = "error";
    }
  }
  zipButton.hidden = results.length === 0;
  go.disabled = false;
});

zipButton.addEventListener("click", async () => {
  const zip = new JSZip();
  for (const result of results) zip.file(result.name, result.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "epubcc.zip";
  link.click();
});
