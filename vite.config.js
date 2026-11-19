import { defineConfig } from "vite";

export default defineConfig({
  base: "/epubcc/",
  server: { host: true, port: 5174 },
});
