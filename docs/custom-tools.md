# Custom tool displays

Every tool call your agent makes routes through a **tool variant** — a small
React component that knows how to render that specific tool's input and output.
Built-in variants ship for `read_file` / `write_file` / `str_replace`, `bash`,
`grep`, `glob`, `web_search`. Anything else falls through to a generic JSON
dump.

This doc shows how to write a variant for a tool the registry doesn't know
about.

## What a variant is

A function component that consumes `ToolVariantProps<Input, Output>` and
returns a `<ToolDisplay>` with the right header summary and body sections.

```ts
import type { ToolVariantProps } from "agentflow";

interface VectorSearchInput  { query: string; topK?: number }
interface VectorSearchOutput { hits: { id: string; score: number; snippet: string }[] }

type Props = ToolVariantProps<VectorSearchInput, VectorSearchOutput>;
```

Props you receive:

| field | what it is |
|---|---|
| `event` | merged `ToolEventLike` carrying `name`, `status`, `durationMs`, `input`, `output`, `isError`, `errorMessage` |
| `mode` | `"request"` (input only) or `"merged"` (input + output) — see below |
| `defaultExpanded` `expanded` `onExpandedChange` | forwarded to the underlying `<ToolDisplay>` |
| `bodyMaxHeight` `className` | layout pass-throughs |

## Request vs. merged mode

Your variant runs twice — once when rendered as a *request* (inside an
`AssistantMessage` or via `<ToolCallRequestDisplay>`), once when rendered as a
*merged* result (via `<ToolCallResultDisplay>` after the tool returns). Honor
the `mode` so each rendering shows the right thing:

| mode | shows | used by |
|---|---|---|
| `'request'` | input only — what the agent asked for | `ToolCallRequestDisplay`, `AssistantMessage` (chat + devtool) |
| `'merged'`  | input *and* output / error | `ToolCallResultDisplay` |

For tools where the input is just a one-line query (`grep`, `glob`,
`web_search`), the collapsed-header summary is usually enough — the request
body can be empty.

## A complete example

```tsx
import {
  ToolDisplay,
  CodeDisplay,
  ErrorInset,
  type ToolVariantProps,
} from "agentflow";

interface VectorSearchInput  { query: string; topK?: number }
interface VectorSearchOutput { hits: { id: string; score: number; snippet: string }[] }

type Props = ToolVariantProps<VectorSearchInput, VectorSearchOutput>;

export function VectorSearchDisplay({ event, mode = "merged", ...rest }: Props) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  // One-liner the collapsed header always shows.
  const summary = `"${input.query}" · top ${input.topK ?? 10}`;

  return (
    <ToolDisplay
      name={name}
      status={status}
      durationMs={durationMs}
      summary={summary}
      {...rest}
    >
      {/* Request body — keep it tight. The query is already in the header. */}
      {mode === "request" && (input.topK !== undefined) && (
        <ToolDisplay.Section label="Parameters">
          <CodeDisplay
            value={JSON.stringify(input, null, 2)}
            language="json"
            copyable={false}
            showLineNumbers={false}
          />
        </ToolDisplay.Section>
      )}

      {/* Merged body — input recap + result. */}
      {mode === "merged" && (
        isError ? (
          <ErrorInset title="Errored" detail={errorMessage} />
        ) : (
          <ToolDisplay.Section label={`${output?.hits.length ?? 0} hits`}>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {output?.hits.map((h) => (
                <li key={h.id}>
                  <code>{h.id}</code> — {h.score.toFixed(3)}
                  <div style={{ color: "var(--fg-3)", fontSize: 13 }}>{h.snippet}</div>
                </li>
              ))}
            </ol>
          </ToolDisplay.Section>
        )
      )}
    </ToolDisplay>
  );
}
```

## Registering it

Pass under the tool's name on `<ConversationView>`:

```tsx
<ConversationView
  events={events}
  toolVariants={{ vector_search: VectorSearchDisplay }}
/>
```

The map merges with `defaultToolVariants` so the built-ins still work. Unknown
tool names fall through to `DefaultToolDisplay` (JSON dump).

The same prop is accepted by `<ToolCallRequestDisplay>`, `<ToolCallResultDisplay>`,
and `<ToolCallsBundle>` if you're composing the layout yourself.

## Reusing primitives

Don't reinvent the wheel — variants compose the four primaries:

| primitive | when to use |
|---|---|
| `<CodeDisplay>` | source code / structured text / log output. Always set `maxHeight` for tool-output-sized content. |
| `<MarkdownDisplay>` | tool output that's actually rich text (eg. an LLM-as-judge rationale) |
| `<DiffViewer>` | before/after pairs (`str_replace`, `apply_patch`, etc.) |
| `<ImageDisplay>` | `screenshot`, `render_chart`, anything that returns an image URL |

For consistent visual rhythm, wrap each section of the body in
`<ToolDisplay.Section label="…">` so the labels stack tidily.

## Body primitives you can compose

Beyond `<ToolDisplay.Section label="…">`, three small primitives are
available for common patterns inside a body:

| primitive | when to use |
|---|---|
| `<ToolDisplay.Chips>` + `<ToolDisplay.Chip label value? tone?>` | Surface input flags / parameters as a chip strip ("case-insensitive", "ctx ±3", "max 100"). Used by Grep / Glob / WebSearch. |
| `<ToolDisplay.ExitInfo exitCode stderr command?>` | Shell-shaped tool failed with a non-zero exit. Renders an exit badge + stderr buffer. Used by Bash; reusable in custom CLI variants. |
| `<ErrorInset title detail>` | One-line failures (file not found, bad input). Use when there's no exit code or stderr. |

Adapters: prefer using the [`inferIsError` helper](./custom-adapters.md)
to compute `isError` from an exit code with a custom okExitCodes list,
rather than threading the exit-code-→-error logic through your variant.

## Slots — when the default header isn't enough

The base `<ToolDisplay>` exposes named slots for power users. Use them when you
need to render a custom badge, a summary that isn't a string, or a body
arrangement the default `children` flow can't express:

```tsx
<ToolDisplay name="bash" status="complete">
  <ToolDisplay.Header>
    {/* completely override the header — you own everything here */}
    <CustomHeaderBar />
  </ToolDisplay.Header>
  <ToolDisplay.Summary>{command}</ToolDisplay.Summary>
  <ToolDisplay.Body>
    <CodeDisplay value={stdout} language="bash" maxHeight={300} collapsible />
  </ToolDisplay.Body>
</ToolDisplay>
```

In practice, `<ToolDisplay.Section>` inside the default `children` covers ~95%
of cases. Reach for slots only when you have a real reason.

## Things to get right

- **Always set a `summary`.** The collapsed header is the only thing scannable
  in long transcripts — make it informative (the file path, the query, the
  command). One line, truncated with ellipsis if too long.
- **Bound your bodies.** `maxHeight` + `collapsible` on inner `<CodeDisplay>` /
  `<MarkdownDisplay>` so a 200kB file or 5MB log output doesn't blow out the
  timeline.
- **Honor `mode`.** A request-only render with a 200kB output section pasted
  in is wrong — the result hasn't happened yet.
- **Errors should look like errors.** Use the shared `<ErrorInset>` inside the
  body when `event.isError`. The `<ToolDisplay>` header dot will already tint
  red because the `status` propagates.

## See also

- [`docs/canonical-tool-shapes.md`](./canonical-tool-shapes.md) — fields each built-in variant accepts + aliases
- [`docs/custom-adapters.md`](./custom-adapters.md) — write an adapter for a custom message format
- [`src/components/tool-variants/`](../src/components/tool-variants/) — the built-in variants
- [`src/components/ToolDisplay.tsx`](../src/components/ToolDisplay.tsx) — base + slots + Chip / Chips / ExitInfo / Section primitives
