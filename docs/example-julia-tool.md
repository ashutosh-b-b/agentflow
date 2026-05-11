# Example: rendering a Julia tool

End-to-end recipe for plugging a custom tool into `<ConversationView>`. We
build a variant for a hypothetical `julia_eval` tool that runs a snippet of
Julia code and returns the value of the last expression plus anything that
was printed.

## 1. The tool's shape

Decide what your tool's **input** and **output** look like. These are
whatever shape your runtime emits — Agentflow doesn't constrain it.

```ts
// my-tools/julia.ts
export interface JuliaInput {
  code: string;
  /** Optional `using ...` packages prepended before the code runs. */
  package_imports?: string[];
}

export interface JuliaOutput {
  /** Value of the final expression, stringified the way Julia's REPL would. */
  result: string;
  /** Anything written to stdout during evaluation. */
  stdout?: string;
  /** True if the evaluation threw. */
  errored?: boolean;
  /** Error message + stacktrace if `errored`. */
  error?: string;
}
```

A `tool_call` event for this tool then looks like:

```jsonc
{
  "id": "evt-12",
  "type": "tool_call",
  "status": "complete",
  "timestamp": 1762257700000,
  "toolCallId": "call_jl_1",
  "toolName": "julia_eval",
  "input": {
    "code": "using LinearAlgebra\nA = [1 2; 3 4]\ndet(A)"
  }
}
```

…and the matching `tool_result`:

```jsonc
{
  "id": "evt-13",
  "type": "tool_result",
  "status": "complete",
  "timestamp": 1762257700156,
  "toolCallId": "call_jl_1",
  "durationMs": 156,
  "output": {
    "result": "-2.0",
    "stdout": ""
  }
}
```

If you're driving the UI from OpenAI / Anthropic API responses, your adapter
parses the `function.arguments` string into `JuliaInput`; you don't need to
write a new adapter just for this tool.

## 2. The variant component

A variant is a React component that receives `ToolVariantProps<Input, Output>`
and returns a `<ToolDisplay>`. Honor `mode='request'` (input only — used
inside an `AssistantMessage`) and `mode='merged'` (input + output — used
when the result lands).

```tsx
// my-tools/JuliaToolDisplay.tsx
import {
  ToolDisplay,
  CodeDisplay,
  ErrorInset,
  type ToolVariantProps,
} from "agentflow-ui";

import type { JuliaInput, JuliaOutput } from "./julia";

type Props = ToolVariantProps<JuliaInput, JuliaOutput>;

export function JuliaToolDisplay({ event, mode = "merged", ...rest }: Props) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  // Header summary — the thing visible when collapsed.
  const summary = firstLine(input.code) || "julia";

  const showInput = mode === "request" || mode === "merged";
  const showOutput = mode === "merged";
  const errored = isError || output?.errored;

  return (
    <ToolDisplay
      name={name}
      status={status}
      durationMs={durationMs}
      summary={summary}
      permission={event.permission}
      toolCallId={event.toolCallId}
      {...rest}
    >
      {showInput && input.package_imports && input.package_imports.length > 0 && (
        <ToolDisplay.Section label="using">
          <CodeDisplay
            value={input.package_imports.map((p) => `using ${p}`).join("\n")}
            language="julia"
            showLineNumbers={false}
            copyable={false}
          />
        </ToolDisplay.Section>
      )}

      {showInput && (
        <ToolDisplay.Section label="Code">
          <CodeDisplay
            value={input.code}
            language="julia"
            copyable
            collapsible
            collapsedHeight={200}
          />
        </ToolDisplay.Section>
      )}

      {showOutput && errored && (
        <ErrorInset
          title={output?.error?.split("\n")[0] ?? "Errored"}
          detail={errorMessage ?? output?.error}
        />
      )}

      {showOutput && !errored && output?.stdout && (
        <ToolDisplay.Section label="stdout">
          <CodeDisplay
            value={output.stdout}
            showLineNumbers={false}
            copyable={false}
            maxHeight={200}
            collapsible
            collapsedHeight={120}
          />
        </ToolDisplay.Section>
      )}

      {showOutput && !errored && output?.result && (
        <ToolDisplay.Section label="Result">
          <CodeDisplay
            value={output.result}
            language="julia"
            showLineNumbers={false}
            copyable={false}
          />
        </ToolDisplay.Section>
      )}
    </ToolDisplay>
  );
}

function firstLine(s: string): string {
  return s.split("\n")[0]?.trim() ?? "";
}
```

A few notes on what this gets you for free:

- The `<ToolDisplay>` header renders the dot, name, summary, duration, and
  chevron in the same shape as every other tool — so a 50-turn transcript
  stays scannable.
- `mode='request'` skips the result-side sections automatically — when the
  assistant's turn renders an inline `julia_eval` request before the runtime
  has executed it, only the code shows.
- `mode='merged'` renders both. `<ToolCallResultDisplay>` uses this so an
  evaluator scrolling through results sees the code that was run *plus* what
  came back.
- The `permission` / `toolCallId` props let `<ToolDisplay>` render the
  Allow / Deny actions automatically when your `<ConversationView>` is
  inside a `<ToolPermissionProvider>`.
- `<CodeDisplay language="julia">` runs your snippet through `highlight.js`
  with the design system's `--code-*` tokens.

## 3. Register it

```tsx
import { ConversationView } from "agentflow-ui";
import { JuliaToolDisplay } from "./my-tools/JuliaToolDisplay";

export function App({ events }) {
  return (
    <ConversationView
      events={events}
      toolVariants={{ julia_eval: JuliaToolDisplay }}
    />
  );
}
```

The map merges with the built-in registry, so `read_file` / `bash` / `grep` /
etc. still work. Tools that aren't in either map fall through to
`DefaultToolDisplay` (a JSON-tree dump), so you never crash on an unknown
tool — you just get a readable fallback until you write a variant for it.

## 4. What the user sees

**Inside an assistant turn** (chat or devtool, tool call still in flight or
without a result attached):

```
🔧 julia_eval   det(A)   running…   ›
```

Click → expanded body shows the `using` block (if any) and the code in a
syntax-highlighted `<CodeDisplay>`.

**As a standalone result** in the timeline (after the tool returned):

```
🔧 julia_eval   det(A)   156ms   ›
```

Click → expanded body shows the request *plus*:

- `stdout` block (only when there's any output)
- `Result` block with `-2.0`
- A coral `ErrorInset` instead, if `output.errored`

## 5. (Optional) Theming

Your variant inherits the design tokens automatically. To brand the Julia
display differently — say a purple accent when running — add scoped styles
in your own CSS:

```css
.ar-tool[data-tool-name="julia_eval"] .ar-dot.accent {
  background: var(--purple);
}
```

Or just write a custom header via the slot API if you need to go further:

```tsx
<ToolDisplay name="julia_eval" status="complete" {...rest}>
  <ToolDisplay.Header>
    <MyJuliaBrandedHeader />
  </ToolDisplay.Header>
  <ToolDisplay.Body>{/* ... */}</ToolDisplay.Body>
</ToolDisplay>
```

## See also

- [`docs/custom-tools.md`](./custom-tools.md) — full reference for tool variants
- [`docs/custom-adapters.md`](./custom-adapters.md) — write an adapter for a custom message format
- [`src/components/tool-variants/`](../src/components/tool-variants/) — the built-in variants for reference
