#!/usr/bin/env node
/**
 * Concatenate the library CSS files into `dist/styles.css`.
 *
 * Run after `tsup` (which clears `dist/` and emits the JS bundles). The
 * docs-only stylesheets (`docs.css`, `site.css`) are intentionally NOT
 * bundled — they're for the docs site, not the library.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const FILES = ["tokens.css", "primitives.css", "components.css"];

const header = `/*
 * agentflow — styles bundle
 *
 * Import once anywhere in your React app:
 *   import "agentflow/styles.css";
 *
 * The CSS variables are namespaced under :root and :root[data-theme="light"].
 * Override them at :root or any ancestor element to re-theme.
 */
`;

let bytes = header.length;
let out = header;
for (const f of FILES) {
  const css = readFileSync(join(root, "src", "styles", f), "utf8");
  out += `\n/* === src/styles/${f} === */\n` + css;
  bytes += css.length;
}

mkdirSync(join(root, "dist"), { recursive: true });
const target = join(root, "dist", "styles.css");
writeFileSync(target, out);
console.log(`build-css → ${target}  (${(out.length / 1024).toFixed(1)} KB, ${FILES.length} files concatenated)`);
