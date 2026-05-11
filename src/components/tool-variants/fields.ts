/**
 * Field-extraction helpers used by built-in variants to read canonical
 * fields from their input / output objects with tolerance for common
 * synonyms (camelCase / snake_case, well-known aliases).
 *
 * Variants reach for these so consumers whose agents emit
 * `{ filepath: ... }` instead of `{ path: ... }` get the right rendering
 * without having to rewrite the variant. The accepted alias tables are
 * documented in `docs/canonical-tool-shapes.md`.
 *
 * Cryptic single-letter aliases (`B`, `A`, `C`, `i`, …) are intentionally
 * NOT accepted at this layer — adapters should rename those at their
 * boundary so the canonical form stays readable.
 */

function asObject(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

/** First key in `keys` that resolves to a string on `obj`. */
export function pickString(obj: unknown, keys: readonly string[]): string | undefined {
  const o = asObject(obj);
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string") return v;
  }
  return undefined;
}

/** First key that resolves to a finite number. */
export function pickNumber(obj: unknown, keys: readonly string[]): number | undefined {
  const o = asObject(obj);
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** First key that resolves to a boolean. */
export function pickBoolean(obj: unknown, keys: readonly string[]): boolean | undefined {
  const o = asObject(obj);
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}

/** First key whose value is anything other than undefined. Use sparingly —
 *  `pickArray<T>(obj, keys)` is preferable for typed reads. */
export function pickAny<T = unknown>(obj: unknown, keys: readonly string[]): T | undefined {
  const o = asObject(obj);
  if (!o) return undefined;
  for (const k of keys) {
    if (o[k] !== undefined) return o[k] as T;
  }
  return undefined;
}

/** First key that resolves to an array. */
export function pickArray<T = unknown>(
  obj: unknown,
  keys: readonly string[]
): T[] | undefined {
  const o = asObject(obj);
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v as T[];
  }
  return undefined;
}

/* ------------ canonical alias tables ------------
 *
 * Exported so consumer-authored adapters / variants can extend the same
 * vocabulary instead of re-inventing it.
 */

export const PATH_KEYS = ["path", "filepath", "file_path", "file", "src", "filename"] as const;
export const CONTENT_KEYS = ["content", "text", "body", "code", "data"] as const;
export const OLD_STR_KEYS = ["old_str", "oldStr", "old", "from", "search"] as const;
export const NEW_STR_KEYS = ["new_str", "newStr", "new", "to", "replace"] as const;

export const COMMAND_KEYS = ["command", "cmd", "script", "shell"] as const;
export const CWD_KEYS = ["cwd", "dir", "directory", "working_dir", "workingDir"] as const;
export const STDOUT_KEYS = ["stdout", "out", "std_out"] as const;
export const STDERR_KEYS = ["stderr", "err", "std_err"] as const;
export const EXIT_CODE_KEYS = ["exitCode", "exit_code", "exit", "status", "code"] as const;

export const PATTERN_KEYS = ["pattern", "regex", "search"] as const;
export const SEARCH_PATH_KEYS = ["path", "dir", "directory", "scope", "root"] as const;

export const GLOB_KEYS = ["glob", "include", "filter"] as const;
export const FILE_TYPE_KEYS = ["type", "extension", "ext", "fileType"] as const;
export const MAX_RESULTS_KEYS = [
  "maxResults",
  "max_results",
  "limit",
  "head_limit",
  "headLimit",
] as const;
export const CONTEXT_BEFORE_KEYS = ["contextBefore", "context_before"] as const;
export const CONTEXT_AFTER_KEYS = ["contextAfter", "context_after"] as const;
export const CONTEXT_LINES_KEYS = ["contextLines", "context_lines", "context"] as const;
export const CASE_INSENSITIVE_KEYS = [
  "caseInsensitive",
  "case_insensitive",
  "ignoreCase",
  "ignore_case",
] as const;
export const MULTILINE_KEYS = ["multiline", "multi_line"] as const;

export const QUERY_KEYS = ["query", "q", "search"] as const;
export const FRESHNESS_KEYS = ["freshness", "recency"] as const;
export const SAFE_MODE_KEYS = ["safeMode", "safe_mode", "safesearch", "safe_search"] as const;
export const LOCALE_KEYS = ["locale", "lang", "language", "country", "region"] as const;

export const GREP_MATCHES_KEYS = ["matches", "results", "hits"] as const;
export const GLOB_FILES_KEYS = ["files", "paths", "results", "matches"] as const;
export const SEARCH_RESULTS_KEYS = ["results", "hits", "items"] as const;
