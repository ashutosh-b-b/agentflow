import hljs from "highlight.js/lib/core";

import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/**
 * Type of a highlight.js grammar function — what
 * `import * as julia from "highlight.js/lib/languages/julia"` gives you.
 */
export type LanguageFn = Parameters<typeof hljs.registerLanguage>[1];

const registered = new Set<string>();

/** File extension (no leading dot, lowercased) → registered language name. */
const extensionMap = new Map<string, string>();

function normalizeExt(ext: string): string {
  return ext.replace(/^\./, "").toLowerCase();
}

/**
 * Register a highlight.js grammar (and optionally one or more file
 * extensions) so `<CodeDisplay language={name}>` and `IOToolDisplay`'s
 * path-based detection both pick it up.
 *
 * @example
 *   import julia from "highlight.js/lib/languages/julia";
 *   registerLanguage(julia, "julia", ".jl");
 *
 *   // optionally register multiple extensions:
 *   registerLanguage(elixir, "elixir", ".ex", ".exs");
 *
 * The grammar can also declare its own `aliases: ["jl"]` array — those
 * still work for `<CodeDisplay language="jl">` because hljs's own alias
 * system honors them. The extensions argument is what teaches the
 * library's *path-based* detection (used by tool variants like
 * IOToolDisplay) to map a file ending in `.jl` onto your grammar.
 *
 * Safe to call repeatedly — the latest registration wins.
 */
export function registerLanguage(
  grammarFn: LanguageFn,
  name: string,
  ...extensions: string[]
): void {
  hljs.registerLanguage(name, grammarFn);
  registered.add(name);
  for (const ext of extensions) {
    extensionMap.set(normalizeExt(ext), name);
  }
}

/**
 * Map a file path (or bare extension) to the registered language name.
 * Returns the language name if the extension is mapped, or the raw
 * extension as a last-resort fallback (so a grammar registered under that
 * exact name picks it up via hljs's name lookup).
 *
 * Used by `IOToolDisplay` and friends; exposed so custom variants can
 * reuse the same logic.
 */
export function languageForPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return extensionMap.get(ext) ?? ext;
}

/* ---------- built-in registrations ---------- */

registerLanguage(bash, "bash", ".sh", ".bash", ".zsh");
registerLanguage(css, "css", ".css");
registerLanguage(diff, "diff", ".diff", ".patch");
registerLanguage(go, "go", ".go");
registerLanguage(javascript, "javascript", ".js", ".jsx", ".mjs", ".cjs");
registerLanguage(json, "json", ".json");
registerLanguage(markdown, "markdown", ".md", ".markdown");
registerLanguage(python, "python", ".py", ".pyi");
registerLanguage(rust, "rust", ".rs");
registerLanguage(shell, "shell");
registerLanguage(sql, "sql", ".sql");
registerLanguage(typescript, "typescript", ".ts", ".tsx");
registerLanguage(xml, "xml", ".xml", ".html", ".htm", ".svg");
registerLanguage(yaml, "yaml", ".yaml", ".yml");

/* ---------- highlighting ---------- */

export interface HighlightedLine {
  /** Pre-balanced HTML for this line — safe to drop into innerHTML. */
  html: string;
  /** Plain text of the line (used for selection / fallback). */
  text: string;
}

/**
 * Highlight `source` and return one entry per line. `<span>` tags that span
 * line breaks are closed at the end of each line and reopened at the start
 * of the next, so each line's HTML is self-contained.
 */
export function highlightLines(source: string, language?: string): HighlightedLine[] {
  const text = source;
  const lines = text.split("\n");

  const lang = language?.toLowerCase();
  if (lang && hljs.getLanguage(lang)) {
    const html = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
    return splitHtmlByLines(html, lines);
  }
  // Plain text fallback — unknown / unregistered language.
  return lines.map((t) => ({ html: escapeHtml(t), text: t }));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Walk a string of `<span class="hljs-…">…</span>`-only HTML and split it
 * on newline boundaries, balancing open spans across lines.
 */
function splitHtmlByLines(html: string, plainLines: string[]): HighlightedLine[] {
  const out: HighlightedLine[] = [];
  const stack: string[] = [];
  let buf = "";
  let lineIdx = 0;
  let i = 0;
  const n = html.length;

  const flushLine = () => {
    let closed = buf;
    for (let j = stack.length - 1; j >= 0; j--) closed += "</span>";
    out.push({ html: closed, text: plainLines[lineIdx] ?? "" });
    lineIdx++;
    buf = stack.join("");
  };

  while (i < n) {
    if (html.startsWith("<span", i)) {
      const end = html.indexOf(">", i) + 1;
      const tag = html.slice(i, end);
      stack.push(tag);
      buf += tag;
      i = end;
    } else if (html.startsWith("</span>", i)) {
      stack.pop();
      buf += "</span>";
      i += 7;
    } else if (html[i] === "\n") {
      flushLine();
      i++;
    } else if (html[i] === "&") {
      const end = html.indexOf(";", i) + 1;
      if (end > 0) {
        buf += html.slice(i, end);
        i = end;
      } else {
        buf += "&amp;";
        i++;
      }
    } else {
      buf += html[i];
      i++;
    }
  }
  flushLine();
  return out;
}

/** Languages registered in this build. Useful for the demo / docs. */
export function listLanguages(): string[] {
  return hljs.listLanguages();
}
