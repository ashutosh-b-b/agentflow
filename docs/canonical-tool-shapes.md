# Canonical tool shapes

The built-in tool variants (`IOToolDisplay`, `BashToolDisplay`,
`GrepToolDisplay`, `GlobToolDisplay`, `WebSearchToolDisplay`) read their
input and output through small "first match wins" alias tables. So if
your agent emits `filepath` instead of `path`, the variant still picks it
up — no need to fork the component.

If your fields aren't covered here, the right move is to **rename in your
adapter** (add the canonical name) rather than write a new variant. The
variants that ship with the library are aimed at common CLI and SDK
shapes; cryptic single-letter aliases (`B`, `A`, `C`, `i`, ...) are
intentionally NOT accepted at this layer — keep the canonical surface
readable.

For tools whose *shape* is genuinely different (vector search hits,
charting tools, custom analyzers), write a custom variant — see
[`docs/custom-tools.md`](./custom-tools.md).

---

## `IOToolDisplay` — `read_file` / `write_file` / `str_replace` / `show_image`

### Input

| canonical | accepted aliases (first match wins) |
|---|---|
| `path`     | `path`, `filepath`, `file_path`, `file`, `src`, `filename` |
| `content`  | `content`, `text`, `body`, `code`, `data` *(used by `write_file`)* |
| `old_str`  | `old_str`, `oldStr`, `old`, `from`, `search` *(used by `str_replace`)* |
| `new_str`  | `new_str`, `newStr`, `new`, `to`, `replace` *(used by `str_replace`)* |
| `src`      | `src`, `url` *(used by `show_image`)* |

### Output

`read_file` may return either:

- a **plain string** (the file contents), or
- an object: `{ content: string }` (or `text` / `body` / `data`).

`write_file` returns `{ bytes_written: number }` (or `bytesWritten`,
`bytes`).

`str_replace` returns `{ replacements: number }`.

### Notes

- Single-key inputs of the form `{ path }` skip the JSON Input section in
  the body — the path is already in the header summary.
- Language is auto-detected from the file extension via highlight.js
  language ids.

---

## `BashToolDisplay` — `bash` / `shell` / `exec`

### Input

| canonical | accepted aliases |
|---|---|
| `command` | `command`, `cmd`, `script`, `shell` |
| `cwd`     | `cwd`, `dir`, `directory`, `working_dir`, `workingDir` |

### Output

| canonical  | accepted aliases |
|---|---|
| `stdout`   | `stdout`, `out`, `std_out` |
| `stderr`   | `stderr`, `err`, `std_err` |
| `exitCode` | `exitCode`, `exit_code`, `exit`, `status`, `code` |

### Notes

- Non-zero exit codes use the shared `<ToolDisplay.ExitInfo>` primitive
  (exit-code badge + stderr buffer). You can compose it directly in your
  own variants.
- "Non-zero exit ≠ error" tools (ripgrep, `git diff`, `cmp`, `jq`) should
  set `isError` correctly via the
  [`inferIsError`](#inferiserror-helper) adapter helper rather than
  relying on the variant's exit-code heuristic.

---

## `GrepToolDisplay` — `grep` / `search`

### Input

| canonical | accepted aliases |
|---|---|
| `pattern`           | `pattern`, `regex`, `search` |
| `path` *(scope)*    | `path`, `dir`, `directory`, `scope`, `root` |
| `caseInsensitive`   | `caseInsensitive`, `case_insensitive`, `ignoreCase`, `ignore_case` |
| `multiline`         | `multiline`, `multi_line` |
| `glob` *(filter)*   | `glob`, `include`, `filter` |
| `maxResults`        | `maxResults`, `max_results`, `limit`, `head_limit`, `headLimit` |
| `contextBefore`     | `contextBefore`, `context_before` |
| `contextAfter`      | `contextAfter`, `context_after` |
| `contextLines`      | `contextLines`, `context_lines`, `context` *(symmetric — applies to both before and after when set)* |

### Output

```ts
{
  matches: Array<{
    file: string;
    lines: Array<{ lineNo: number; text: string }>;
  }>;
  totalMatches?: number;     // synonyms: total_matches
  totalFiles?: number;       // synonyms: total_files
  truncated?: number;        // count of additional files not included
}
```

### Notes

- **Empty array `output.matches: []` is rendered as "No matches.", not as
  an error.** Adapters wrapping ripgrep/`grep` should set `isError: false`
  (or use `inferIsError(result, { okExitCodes: [0, 1] })`).
- Set flags get rendered as a chip strip in the body header
  (`case-insensitive`, `glob: *.ts`, `ctx ±3`, etc.).
- Asymmetric context renders as `ctx −5 / +1`.

---

## `GlobToolDisplay` — `glob` / `find`

### Input

| canonical | accepted aliases |
|---|---|
| `pattern`         | `pattern`, `glob`, `q`, `query` |
| `path` *(scope)*  | `path`, `dir`, `directory`, `scope`, `root` |
| `type`            | `type`, `extension`, `ext`, `fileType` |
| `caseInsensitive` | `caseInsensitive`, `case_insensitive`, `ignoreCase`, `ignore_case` |
| `maxResults`      | `maxResults`, `max_results`, `limit`, `head_limit`, `headLimit` |

### Output

```ts
{
  files: Array<{ path: string; sizeBytes?: number }>;
  truncated?: number;  // count of additional files not included
}
```

`files` synonyms: `paths`, `results`, `matches`.

### Notes

- Empty `output.files: []` → "No files." text. Same convention as Grep.

---

## `WebSearchToolDisplay` — `web_search`

### Input

| canonical | accepted aliases |
|---|---|
| `query`     | `query`, `q`, `search` |
| `freshness` | `freshness`, `recency` |
| `safeMode`  | `safeMode`, `safe_mode`, `safesearch`, `safe_search` |
| `locale`    | `locale`, `lang`, `language`, `country`, `region` |
| `maxResults`| `maxResults`, `max_results`, `limit`, `head_limit`, `headLimit` |

### Output

```ts
{
  results: Array<{ title: string; url: string; snippet?: string }>;
}
```

`results` synonyms: `hits`, `items`.

### Notes

- Empty `output.results: []` → "No results." text.

---

## Empty vs errored — universal rule

Convention every variant follows:

| `output` shape | Renders as |
|---|---|
| `undefined`                                 | pending / streaming (no body) |
| `{ matches: [] }` / `{ files: [] }` / `{ results: [] }` | empty-state text ("No matches." / "No files." / "No results.") |
| `isError: true`                             | `<ErrorInset>` / `<ToolDisplay.ExitInfo>` (coral) |
| anything else                               | the variant's normal output rendering |

**Adapters: don't set `isError: true` just because exit code is non-zero.**
Many tools (ripgrep, `git diff`, `cmp`, `jq`) use non-zero exit to signal
"I produced no output", not failure. Use the `inferIsError` helper:

```ts
import { inferIsError } from "agentflow";

// ripgrep: exit 0 = matched, 1 = no matches, 2+ = real error
const isError = inferIsError(rgOutput, { okExitCodes: [0, 1] });
```

---

## `inferIsError` helper

```ts
inferIsError(output: unknown, opts?: { okExitCodes?: number[] }): boolean
```

Reads `exitCode` (or `exit_code` / `exit` / `status` / `code`) off the
output object and returns `true` when the code isn't in `okExitCodes`
(which defaults to `[0]`). Returns `false` when no exit code is present —
the helper doesn't speculate about errors from arbitrary output shapes;
that kind of detection should live in your adapter.

---

## Things this layer deliberately doesn't do

- **No cryptic short aliases.** `B` / `A` / `C` / `i` / `q` (when ambiguous)
  / single-letter flags are NOT in the alias tables. They're CLI-specific
  shorthand; canonical-camel/snake stays readable. Adapters rename if
  needed.
- **No configurable per-variant `flagFields` prop.** If you need richer or
  reordered chips, write a custom variant using the
  `<ToolDisplay.Chips>` / `<ToolDisplay.Chip>` primitives. The registry
  exists for that.
- **No auto-detection of "error" from prose / JSON shape.** Only from
  exit codes via `inferIsError`. Anything fancier belongs in your
  adapter, where it can reflect agent-specific conventions.

## See also

- [`docs/custom-adapters.md`](./custom-adapters.md) — write an adapter for a custom message format
- [`docs/custom-tools.md`](./custom-tools.md) — write a variant for a tool whose shape genuinely differs
- [`docs/example-julia-tool.md`](./example-julia-tool.md) — full example: a custom tool from input typing through registration
