import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config — used only for the docs site (`npm run dev` and
 * `npm run build:docs`). The library bundle is built by tsup; see
 * `tsup.config.ts`.
 *
 * `base` is configurable via the SITE_BASE env var so the GitHub Pages
 * deploy can emit paths under `/agentflow/` while local dev stays at `/`.
 */
export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE || "/",
  server: { port: 5173 },
  build: {
    // Library bundle lives in `dist/` (tsup). Docs site goes elsewhere so
    // the two never clobber each other.
    outDir: "dist-docs",
    emptyOutDir: true,
  },
});
