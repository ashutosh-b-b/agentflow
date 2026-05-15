# Changelog

All notable changes to `agentflow-ui` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-05-15

### Changed

- **Tool-card header stats unified.** Duration now uses
  `.ar-tool-stat.duration` instead of the generic `.meta` class, matching
  `.ar-tool-stat.cost` and `.ar-tool-stat.tokens`. All three siblings now
  wear the same pill styling (border, background, padding) so the metric
  row reads as a uniform group. Consumers who previously targeted
  `.ar-tool-head .meta` in their own theme overrides should switch to
  `.ar-tool-head .ar-tool-stat.duration`. (The `.meta` class still exists
  elsewhere in the library — only the tool-card duration span moved.)

## [0.2.1] - 2026-05-15

### Fixed

- **Tool-card header chips drifted off-axis from the duration.** With
  `costUsd` + `tokens` + `durationMs` all set, the `.ar-tool-stat` pills and
  `.meta` span sat in the same flex row with `align-items: center`, but each
  centered around its own internal midline because `.meta` inherited the
  parent's `line-height` (~1.5) while the chip used `inline-flex + padding +
  border` with no `line-height` reset. Normalized `line-height: 1` on both
  siblings and gave `.meta` `display: inline-flex; align-items: center` so
  every header child uses a common cross-axis metric. Chip padding eased
  from `1px 6px` → `2px 7px` for breathing room.

## [0.2.0] - 2026-05-15

### Added

- **`expandToolInputBtn` / `expandToolOutputBtn` props on `<ConversationView>`** —
  control whether the "Show more / Show less" toggle inside a tool card's
  **input** and **output** blocks is available. Default `true`. When `false`,
  content renders in full inside a fixed `maxHeight` box with internal scroll;
  no inner clamp/expand control. The outer tool-card chevron is unaffected.
  Threaded through `ToolCallRequestDisplay` (`inputCollapsible`),
  `ToolCallResultDisplay` (`inputCollapsible` + `outputCollapsible`),
  `AssistantMessage` (`toolInputCollapsible`), and `ToolCallsBundle`
  (`inputCollapsible`).
- **`inputCollapsible` / `outputCollapsible` on `ToolVariantProps`** — variant
  authors can read these and forward to inner display primitives (`CodeDisplay`,
  `DiffViewer`, `MarkdownDisplay`, etc.). Built-in variants (`IOToolDisplay`,
  `BashToolDisplay`, `DefaultToolDisplay`) honour them automatically.
- **`costUsd?: number` and `tokens?: number` on `ToolResultEvent`** — when
  provided by the consumer, surface as small pill chips in the tool-card header
  next to the duration. Formatters scale precision so sub-cent costs don't
  round to `$0.00`. Threaded through `ToolEventLike` so all variants receive
  them; built-in variants forward to `<ToolDisplay>` automatically.
- **Hierarchical devtool filter** matching the wireframe:
  - `Messages` → `User Message`, `Assistant Message`, `Tool Messages` →
    one row per distinct tool name (counts derived from the events).
  - `Status` → tri-state `All` / `Passed` / `Failed` (mutually exclusive).
  - Counts visible per row; newly observed tool names default to enabled.

### Changed

- **Devtool sidebar/thread spacing tightened.** Sidebar padding `14px 16px →
  12px`; thread padding `28px 32px → 16px 20px`; thread `margin: 0 auto → 0`
  so the conversation hugs the sidebar instead of being centered with empty
  left gutter on wider viewports.

### Docs

- Added a synthetic errored bash test-run turn to the live
  `ConversationViewFeatures` demo so the new **Status → Failed** filter has
  something to show. The errored result also carries `costUsd` + `tokens` so
  the new header chips render in the preview.
- `JuliaToolDisplay` example in `CustomTools.tsx` updated to demonstrate
  reading `inputCollapsible` / `outputCollapsible` and forwarding
  `event.costUsd` / `event.tokens`.

### Migration notes

All additions are additive and backward-compatible. No breaking changes.

- Existing consumers see no behavioural change: the new
  `expandToolInputBtn` / `expandToolOutputBtn` default to `true`, preserving
  the previous "Show more" behaviour.
- `costUsd` and `tokens` chips render **only when the consumer sets them** on
  a `ToolResultEvent`; omitting them keeps the header identical to 0.1.x.
- The devtool filter rewrite preserves the same set-of-events filtered
  behaviour, just exposed via a hierarchical tree instead of a flat list.

## [0.1.0] - 2026-05-13

### Added

- Initial public release of `agentflow-ui`.
- Primitives: `CodeDisplay`, `MarkdownDisplay`, `DiffViewer`, `ImageDisplay`,
  `JsonDisplay`.
- Secondaries: `UserMessage`, `AssistantMessage` (bubble + flat),
  `ThinkingDisplay`, `CompactionDisplay`, `ErrorDisplay`,
  `SystemMessageDisplay`.
- `ToolDisplay` with slot API (`Header`, `Summary`, `Body`, `Section`,
  `Chip`, `Chips`, `ExitInfo`) and 6 built-in variants (`read_file`,
  `write_file`, `str_replace`, `bash`, `grep`, `glob`, `web_search`).
- `ToolCallRequestDisplay` + `ToolCallResultDisplay` + `ToolCallsBundle`.
- `ConversationView` with three modes — `chat`, `devtool`, `inspector` —
  including search, live-tail auto-scroll, permission UX, and a component
  override prop.
- Adapters for OpenAI Chat Completions and Anthropic Messages plus the
  `MessageAdapter<TMessage>` interface for custom formats.
- CSS-variable theming via `tokens.css`; light/dark presets via
  `[data-theme]`.
- `registerLanguage()` runtime helper for custom syntax highlighting.

[0.2.2]: https://github.com/ashutosh-b-b/agentflow/releases/tag/v0.2.2
[0.2.1]: https://github.com/ashutosh-b-b/agentflow/releases/tag/v0.2.1
[0.2.0]: https://github.com/ashutosh-b-b/agentflow/releases/tag/v0.2.0
[0.1.0]: https://github.com/ashutosh-b-b/agentflow/releases/tag/v0.1.0
