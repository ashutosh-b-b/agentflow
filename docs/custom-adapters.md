# Custom adapters

An **adapter** converts a provider-specific message log into Agentflow's
normalized `ConversationEvent[]` stream. The rendering layer only consumes the
normalized format — adapters are the seam that lets one component library
render OpenAI, Anthropic, AG-UI, and your in-house agent format.

We ship adapters for OpenAI Chat Completions and Anthropic Messages out of the
box. This doc shows how to write your own.

## The contract

```ts
import type { MessageAdapter, ConversationEvent } from "agentflow-ui";

interface MessageAdapter<TMessage> {
  toEvents(messages: TMessage[]): ConversationEvent[];
}
```

That's it for the static (non-streaming) case. A custom adapter is a function
(or factory) that produces `ConversationEvent[]` — the same array that
`<ConversationView events={...} />` consumes.

The full event union and per-event field shapes are documented in
[`src/types/events.ts`](../src/types/events.ts) and `plan.md` §3.

## Writing one

Two choices: direct function, or a factory bound to options.

### Direct function

```ts
import type { ConversationEvent, UserMessageEvent, AssistantMessageEvent } from "agentflow-ui";

interface MyMessage {
  speaker: "human" | "agent";
  body: string;
  at: string; // ISO timestamp
}

export function myFormatToEvents(messages: MyMessage[]): ConversationEvent[] {
  return messages.map((m, i): UserMessageEvent | AssistantMessageEvent => ({
    id: `m-${i}`,
    type: m.speaker === "human" ? "user_message" : "assistant_message",
    status: "complete",
    timestamp: Date.parse(m.at),
    content: m.body,
  }));
}

// usage
<ConversationView events={myFormatToEvents(transcript)} />
```

### Factory + options

When the adapter needs runtime config (synthesized timestamps, ID prefix,
streaming flag, etc.), use the helpers we ship. They handle the boilerplate so
your adapter focuses on the format-specific parts.

```ts
import {
  type AdapterOptions,
  type MessageAdapter,
  createAdapterContext,
  durationFromContext,
  safeParseJson,
} from "agentflow-ui/adapters";

export interface MyAdapterOptions extends AdapterOptions {
  /** Treat the trailing message as still-streaming. */
  streamLast?: boolean;
}

export function myFormatToEvents(
  messages: MyMessage[],
  opts: MyAdapterOptions = {}
): ConversationEvent[] {
  const ctx = createAdapterContext(opts);
  const out: ConversationEvent[] = [];

  for (const msg of messages) {
    out.push({
      id: ctx.newId(),
      type: msg.speaker === "human" ? "user_message" : "assistant_message",
      status: "complete",
      timestamp: ctx.tick(),
      content: msg.body,
      raw: msg, // optional but recommended — saves you when you need a field you didn't model
    });
  }

  return out;
}

export function createMyMessageAdapter(
  opts: MyAdapterOptions = {}
): MessageAdapter<MyMessage> {
  return { toEvents: (messages) => myFormatToEvents(messages, opts) };
}
```

## Helpers

`createAdapterContext(opts)` returns:

| field | purpose |
|---|---|
| `newId()` | counter-based stable IDs (`evt-1`, `evt-2`, …) |
| `tick(extraMs?)` | advance the synthetic clock and return the new timestamp |
| `callTimes` | `Map<toolCallId, timestamp>` — populate on tool_call, read on tool_result for `durationMs` |

`durationFromContext(ctx, toolCallId, resultTs)` — convenience for the common
"tool result lands, what was the call→result delta" pattern.

`safeParseJson(s)` — `JSON.parse` that falls back to the original string on
failure. Useful when a provider serializes tool inputs/outputs as JSON strings.

## Tool calls + results

If your format has tool calls, emit them as `tool_call` events with a stable
`toolCallId`. Tool results carry the same `toolCallId` so the rendering layer
can pair them up:

```ts
const callTs = ctx.tick();
ctx.callTimes.set(toolUse.id, callTs);
out.push({
  id: ctx.newId(),
  type: "tool_call",
  status: "complete",
  timestamp: callTs,
  toolCallId: toolUse.id,
  toolName: toolUse.name,
  input: toolUse.input, // unknown — pass through whatever the model emitted
});

// later, when the result lands:
const resultTs = ctx.tick();
out.push({
  id: ctx.newId(),
  type: "tool_result",
  status: "complete",
  timestamp: resultTs,
  toolCallId: toolUse.id,
  durationMs: durationFromContext(ctx, toolUse.id, resultTs),
  output: parsedOutput,
  isError: !!isError,
});
```

If your tool name isn't in the default registry, write a [tool variant](./custom-tools.md).

## Things to get right

- **Stable IDs.** Every event needs a unique `id`. Synthesizing them from a
  counter is fine; just don't reuse them between adapter invocations.
- **Timestamps go up.** Render order is timestamp-based. If your provider
  doesn't supply timestamps, synthesize monotone ones via `ctx.tick()`.
- **Preserve `raw`.** Costs nothing, saves you when you need a field you didn't
  model. The Inspector view shows it directly.
- **Don't lie about `status`.** A still-arriving message is `streaming`, a
  finished one is `complete`, an in-progress tool result is `streaming`. The
  components key visual treatment off this — pulses, carets, dots.
- **Empty vs errored vs pending — distinguish them.** This is the universal
  rule the variants enforce:
  - `output: undefined` → pending/streaming (no body shown).
  - `output.matches: []` / `output.files: []` / `output.results: []` →
    rendered as a small "No matches." / "No files." / "No results." line —
    NOT as an error.
  - `isError: true` → coral error block.
  Many CLIs (ripgrep, `git diff`, `cmp`, `jq`) use a non-zero exit to mean
  "I produced no output" rather than "I failed". Don't blindly map exit code
  to `isError` — use the `inferIsError` helper:
  ```ts
  import { inferIsError } from "agentflow-ui";
  // ripgrep: exit 0 matched, exit 1 no matches, exit 2+ real error.
  isError: inferIsError(rgOutput, { okExitCodes: [0, 1] }),
  ```
- **Tool results' `isError`.** Only set this when you actually know it. When
  in doubt leave it false; the variant code can still surface a non-zero
  exit code via the dot.

## Streaming adapters (sketch — not yet exported)

The streaming side of the contract (plan §5):

```ts
interface Adapter<TChunk = unknown> {
  reset(): void;
  ingest(chunk: TChunk): EventDelta[];
  finalize(): EventDelta[];
}

type EventDelta =
  | { kind: "create"; event: ConversationEvent }
  | { kind: "append"; id: string; field: "content" | "inputRaw"; chunk: string }
  | { kind: "patch"; id: string; patch: Partial<ConversationEvent> }
  | { kind: "status"; id: string; status: EventStatus };
```

A consumer drives a transport, feeds chunks to `ingest`, and applies the
returned `EventDelta[]` to a store the components subscribe to. Land this when
you wire up transports — the static `MessageAdapter<TMessage>` form is enough
for log replay and post-hoc rendering.

## See also

- [`docs/canonical-tool-shapes.md`](./canonical-tool-shapes.md) — what fields each built-in variant reads + accepted aliases
- [`docs/custom-tools.md`](./custom-tools.md) — adding a renderer for a tool the registry doesn't know
- [`src/adapters/openai.ts`](../src/adapters/openai.ts) — the OpenAI implementation
- [`src/adapters/anthropic.ts`](../src/adapters/anthropic.ts) — the Anthropic implementation
- [`src/types/events.ts`](../src/types/events.ts) — full event schema
