# Agentic Conversation Display — Project Scope

A React component library for rendering agentic conversations. Composable primitives that work equally well for end-user chat UIs and developer-facing inspector tools, fed by a unified event format with adapters for OpenAI, Anthropic, and AG-UI.

**Working name:** agentflow (check npm availability etc.)

---

## 1. Goals and non-goals

### Goals

- **One set of components, two audiences.** The same `<ToolCall>` renders as a tasteful pill in a product chat and as an expandable inspector panel in a devtool. Verbosity controlled by context, not parallel implementations.
- **Composable, not monolithic.** Consumers build their transcript by composing primitives. There is no single `<Chat>` component that does everything. Radix/shadcn-style.
- **Bounded by default.** Every component has a finite, scrollable footprint. Long content is collapsible. Long transcripts don't become 30,000-pixel scroll-fests. This is treated as a correctness requirement, not a polish item.
- **Format-agnostic input.** Components consume a single normalized event format. Adapters convert OpenAI, Anthropic, and AG-UI streams into that format. Custom backends implement the same adapter interface.
- **Transport-agnostic.** HTTP/SSE and WebSocket transports ship out of the box. Both feed the same adapter pipeline.
- **Copy-paste registry, not black-box package.** Styled components ship as raw `.tsx` files via a shadcn-compatible registry. Consumers own the code.
- **TypeScript-first.** Strict types, discriminated unions, no `any` in public APIs.

### Non-goals

- Not a full chat application. No persistence, no auth, no message sending UI by default (though we ship optional input components).
- Not a backend. We don't proxy LLM calls or manage API keys.
- Not a state management library. We use React context and simple stores; consumers can swap in Zustand/Redux/Jotai if they want.
- Not a generative-UI framework. Tool calls render via a registry of components; we don't dynamically execute LLM-generated UI code.
- Not React Native (initially).

---

## 2. Architecture overview

Four layers, strictly separated. Each is independently swappable.

```
┌─────────────────────────────────────────────────────────────┐
│  Components (event-aware: UserMessage, ToolCallRequest, …) │
├─────────────────────────────────────────────────────────────┤
│  Store (in-memory event log + streaming reducer)           │
├─────────────────────────────────────────────────────────────┤
│  Adapter (chunk → normalized event delta)                  │
├─────────────────────────────────────────────────────────────┤
│  Transport (HTTP/SSE, WebSocket, custom)                   │
└─────────────────────────────────────────────────────────────┘
```

**Transport** delivers raw chunks. **Adapter** is a stateful parser that converts chunks into normalized event deltas. **Store** holds the event log and applies deltas. **Components** render events from the store.

The hook `useConversation({ transport, adapter })` wires layers 2–4 together. Components subscribe to the store via context.

---

## 3. The unified event format

This is the single most important design decision. Components only ever see this format; everything else is an adapter target.

### 3.1 Design principles

- **One event per semantic unit, not per API message.** An OpenAI assistant message with two tool calls becomes three events: assistant text + two tool_calls.
- **Lossless when possible.** Every event carries a `raw` field with the original payload from the upstream format. Costs nothing, saves you when you need a field you didn't model.
- **Streaming-aware.** Every event has a `status` field. Streamed content accumulates via deltas, not full replacements.
- **AG-UI compatible.** Where AG-UI defines an event, we mirror its semantics so AG-UI streams pass through with a near-identity adapter.

### 3.2 Event schema

```ts
type EventStatus = 'pending' | 'streaming' | 'complete' | 'error';

interface BaseEvent {
  id: string;                    // stable unique ID
  type: EventType;
  timestamp: number;             // ms since epoch
  status: EventStatus;
  threadId?: string;             // optional, for multi-thread support
  parentId?: string;             // optional, for nested/branched conversations
  raw?: unknown;                 // original upstream payload
  meta?: Record<string, unknown>; // adapter-specific extras
}

type EventType =
  | 'user_message'
  | 'assistant_message'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'compaction'
  | 'system_message'
  | 'error'
  | 'citation';

interface UserMessageEvent extends BaseEvent {
  type: 'user_message';
  content: string;               // markdown
  attachments?: Attachment[];
}

interface AssistantMessageEvent extends BaseEvent {
  type: 'assistant_message';
  content: string;               // markdown, accumulates while streaming
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: TokenUsage;
}

interface ThinkingEvent extends BaseEvent {
  type: 'thinking';
  content: string;               // reasoning text, accumulates while streaming
  durationMs?: number;
}

interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  toolCallId: string;            // links to the corresponding tool_result
  toolName: string;
  input: unknown;                // accumulates as JSON during streaming
  inputRaw?: string;             // raw partial JSON during streaming
}

interface ToolResultEvent extends BaseEvent {
  type: 'tool_result';
  toolCallId: string;            // matches a ToolCallEvent
  output: unknown;
  isError?: boolean;
  durationMs?: number;
}

interface CompactionEvent extends BaseEvent {
  type: 'compaction';
  summary: string;
  compactedEventIds: string[];
  tokensBefore?: number;
  tokensAfter?: number;
}

interface SystemMessageEvent extends BaseEvent {
  type: 'system_message';
  content: string;
}

interface ErrorEvent extends BaseEvent {
  type: 'error';
  message: string;
  code?: string;
  retryable?: boolean;
  stack?: string;
}

interface CitationEvent extends BaseEvent {
  type: 'citation';
  sourceUrl?: string;
  sourceTitle?: string;
  snippet?: string;
  anchorEventId: string;         // the assistant event this cites
  anchorRange?: [number, number]; // char offsets in anchor's content
}

type ConversationEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | CompactionEvent
  | SystemMessageEvent
  | ErrorEvent
  | CitationEvent;

interface Conversation {
  id: string;
  events: ConversationEvent[];
  metadata?: Record<string, unknown>;
}
```

### 3.3 Streaming model

Components subscribe to events by ID. Adapters emit `EventDelta` objects that the store applies:

```ts
type EventDelta =
  | { kind: 'create'; event: ConversationEvent }
  | { kind: 'append'; id: string; field: 'content' | 'inputRaw'; chunk: string }
  | { kind: 'patch'; id: string; patch: Partial<ConversationEvent> }
  | { kind: 'status'; id: string; status: EventStatus };
```

The store is a simple reducer over deltas. Components subscribe to individual event IDs via `useEvent(id)`, so a streaming text update only re-renders the affected message — not the whole list.

---

## 4. Transports

Transports deliver raw chunks. They expose a uniform interface:

```ts
interface Transport<TChunk = unknown> {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(payload: unknown): Promise<void>;        // for bidirectional transports
  onChunk(handler: (chunk: TChunk) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  onClose(handler: () => void): () => void;
}
```

### 4.1 HTTP / SSE transport

```ts
const transport = createHttpTransport({
  url: '/api/chat',
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: { messages, model: 'gpt-4o' },
  // Auto-detects SSE from Content-Type, falls back to JSON-lines, then whole-response.
});
```

- Uses `fetch` with a streaming response body.
- Parses Server-Sent Events when `Content-Type: text/event-stream`.
- Falls back to newline-delimited JSON when `application/x-ndjson`.
- Falls back to whole-response JSON otherwise.
- Auto-reconnects on transient failures with exponential backoff (configurable).
- Supports `AbortController` for cancellation.

### 4.2 WebSocket transport

```ts
const transport = createWebSocketTransport({
  url: 'wss://api.example.com/agent',
  protocols: ['agent-v1'],
  reconnect: { attempts: 5, backoffMs: 1000 },
  resumable: true,                // sends lastEventId on reconnect
});
```

- Handles connect/reconnect/backoff with configurable strategy.
- Optional resumability: tracks `lastEventId` and sends it on reconnect; backends opting in get continuity, others get a clean restart with a visible "reconnected" marker event injected into the stream.
- Supports binary frames (passes through to adapter unchanged).
- Heartbeat/ping support (configurable interval).

### 4.3 Custom transports

The interface is small enough that wrapping a custom protocol — long-polling, gRPC-Web, postMessage from an iframe, an in-memory mock for tests — is straightforward. We ship a `createMemoryTransport()` for tests and a documented example of a custom transport.

---

## 5. Adapters

Adapters are stateful stream parsers. Same interface for static and streaming use:

```ts
interface Adapter<TChunk = unknown> {
  reset(): void;
  ingest(chunk: TChunk): EventDelta[];
  finalize(): EventDelta[];
}

// For full-message conversion (no streaming):
interface MessageAdapter<TMessage> {
  toEvents(messages: TMessage[]): ConversationEvent[];
  fromEvents(events: ConversationEvent[]): TMessage[];  // optional, for round-tripping
}
```

### 5.1 Built-in adapters

| Adapter | Streaming | Bidirectional | Notes |
|---|---|---|---|
| `createOpenAIAdapter()` | ✅ | ✅ | SSE chunks with `delta` accumulation; tool call args arrive as JSON string fragments. |
| `createAnthropicAdapter()` | ✅ | ✅ | Typed event stream (`message_start`, `content_block_*`, etc.); maps thinking blocks to `thinking` events. |
| `createAGUIAdapter()` | ✅ | ✅ | Near-identity mapping; AG-UI's ~16 event types map directly. |
| `createIdentityAdapter()` | ✅ | ✅ | For backends that already emit our format. |

### 5.2 Adapter contract

- **Pure where possible.** State is only the partial-event accumulator (e.g. half-streamed tool input JSON). No I/O, no globals.
- **Idempotent `finalize()`.** Calling `finalize()` after a clean stream end is a no-op. Calling it after disconnect emits `status: 'error'` for any in-progress events.
- **Tested with fixture pairs.** Each adapter ships with `__fixtures__/` containing real captured chunk streams and the expected `EventDelta[]` output. Snapshot tests guard against regressions.

### 5.3 Custom adapters

Documented interface, example implementation, and a `createCustomAdapter()` helper that handles common boilerplate (ID generation, status transitions). Anyone with a proprietary backend writes one adapter and gets the whole component library for free.

---

## 6. Components

Two tiers. Primary components are pure renderers with no event awareness. Secondary components are event-aware and compose primaries.

### 6.1 Primary components (rendering primitives)

Pure renderers. No knowledge of events, messages, or tools. Reusable anywhere.

#### `<CodeDisplay>`

```tsx
<CodeDisplay
  value={code}
  language="python"
  showLineNumbers={true}
  highlightLines={[3, 7]}
  maxHeight={400}              // pixels; content beyond scrolls
  collapsible={true}           // wraps in expand/collapse if content exceeds maxHeight
  defaultCollapsed={false}
  collapsedHeight={120}        // height when collapsed
  copyable={true}
  theme="github-dark"          // shiki theme name
/>
```

- Syntax highlighting via `shiki` (better themes, lazy-loaded grammars).
- Line numbers toggleable.
- Specific lines can be highlighted.
- Built-in copy button (toggleable).
- **Bounded height by default.** Content exceeding `maxHeight` scrolls within the block; the page itself doesn't grow unbounded. This is the default for *every* code render.
- **Collapsible when long.** If `collapsible` and the content exceeds `collapsedHeight`, the block renders collapsed with a fade-out gradient and an "Expand" affordance. Click expands to `maxHeight` (still scrollable inside if even longer).
- Themes match Tailwind dark/light mode by default.

#### `<MarkdownDisplay>`

```tsx
<MarkdownDisplay
  value={markdown}
  components={{ /* override per-element */ }}
  allowHtml={false}
  codeTheme="github-dark"
  maxHeight={null}             // null = unbounded; number = scroll inside
  collapsible={false}          // for very long markdown blocks
  collapsedHeight={200}
/>
```

- `react-markdown` + `remark-gfm` (tables, strikethrough, task lists, autolinks).
- Fenced code blocks route through `<CodeDisplay>` for consistency (and inherit its overflow behavior).
- Math via optional `remark-math` + `rehype-katex` (lazy-loaded).
- Per-element overrides for custom rendering of links, images, etc.
- HTML disabled by default for safety; opt-in.
- **Bounded mode for tool outputs.** When rendering tool result text (often very long), pass `maxHeight` to scroll inside; the parent `<ToolDisplay>` provides the collapsibility. For chat messages, leave `maxHeight={null}`.

#### `<DiffViewer>`

```tsx
<DiffViewer
  oldValue={before}
  newValue={after}
  language="typescript"
  view="unified"               // 'unified' | 'split'
  showLineNumbers={true}
  contextLines={3}
  maxHeight={500}
  collapsible={true}
  defaultCollapsed={false}
  collapseUnchanged={true}     // hide unchanged regions beyond contextLines
/>
```

- GitHub-style unified diff by default; split view available.
- Composes `<CodeDisplay>` for syntax-highlighted lines.
- Handles new-file (empty old) and deleted-file (empty new) cases.
- **Auto-collapses unchanged regions** beyond `contextLines` with a clickable "… N unchanged lines" affordance (GitHub-style).
- Bounded by `maxHeight`; scrolls inside.
- For very large diffs, the whole component is collapsible with a header summary ("+42 -17 in 4 files").

#### `<ImageDisplay>`

```tsx
<ImageDisplay
  src={url}
  alt={description}
  maxHeight={400}
  lightbox={true}
/>
```

- Max-height with click-to-expand lightbox modal.
- Loading and error states.
- Supports data URLs, blob URLs, and external URLs.
- Lazy-loaded by default.

### 6.2 Secondary components (event-aware)

Compose primaries. Read events from the store via context.

#### `<UserMessage>`

```tsx
<UserMessage event={event} maxHeight={null} collapsible={false} />
```

- Renders `event.content` via `<MarkdownDisplay>`.
- Renders attachments inline (images via `<ImageDisplay>`, others as download chips).
- **Long-message handling.** Default unbounded (chat-typical). For pasted-code or long-prompt cases, set `collapsible={true}` to clamp to ~10 lines with a "Show more" affordance.
- Verbosity-aware: minimal mode shows just the content; verbose mode adds timestamp, token count, and a raw-payload toggle.

#### `<AssistantMessage>`

```tsx
<AssistantMessage
  event={event}
  toolCallDisplay="full"        // 'full' | 'input-only' | 'name-only' | 'none'
/>
```

- Renders `event.content` via `<MarkdownDisplay>`.
- Inlines associated `<ToolCallRequestDisplay>` components (looked up by `toolCallId`).
- Tool call display configurable per the prop (or context default).
- Streaming cursor while `status === 'streaming'`.
- Verbose mode adds finish reason, token usage, and timing.

#### `<ThinkingDisplay>`

```tsx
<ThinkingDisplay event={event} defaultExpanded={false} />
```

- Collapsed pill: "Thought for 12s". Click to expand.
- Expanded: full reasoning via `<MarkdownDisplay>`.
- Verbose mode: token count + duration breakdown.

#### `<ToolDisplay>` (base + variants)

Composition, not class inheritance. The base provides layout; variants pass appropriate primaries as children.

**Collapsed by default in chat mode, expanded by default in devtool mode.** The collapsed state shows only the header (tool name, status, duration); clicking expands the body.

```tsx
// Base layout
<ToolDisplay
  name="read_file"
  status="complete"
  durationMs={142}
  defaultExpanded={false}        // mode-aware default if omitted
  expanded={controlled}          // optional controlled mode
  onExpandedChange={setExpanded}
  header={<CustomHeader />}      // optional override
  summary="src/index.ts"         // shown in collapsed header
  bodyMaxHeight={500}            // body scrolls if taller
>
  {/* body content provided by variant */}
</ToolDisplay>
```

The header is always visible and always shows: tool name, status icon, duration, and a one-line summary (e.g. file path for I/O tools, query for search tools). The body is collapsed/expanded.

```tsx
// Variants are thin wrappers
<IOToolDisplay event={event} />       // composes CodeDisplay / DiffViewer / ImageDisplay
<GrepToolDisplay event={event} />     // composes a result list with CodeDisplay snippets
<GlobToolDisplay event={event} />     // composes a file path list
<BashToolDisplay event={event} />     // composes CodeDisplay for stdin / stdout / stderr
<WebSearchToolDisplay event={event} /> // composes a search-result card list
```

Each variant knows how to extract its tool's specific fields, generate a useful one-line summary for the collapsed header, and arrange the right primaries inside `<ToolDisplay>`'s body. Variants don't know whether they're rendering a request or a result — that's the wrapper's job.

**Slot API for power users:**

```tsx
<ToolDisplay name="bash" status="complete">
  <ToolDisplay.Header>
    <CustomBadge />
  </ToolDisplay.Header>
  <ToolDisplay.Summary>{command}</ToolDisplay.Summary>
  <ToolDisplay.Body>
    <CodeDisplay value={stdout} language="bash" maxHeight={300} collapsible />
  </ToolDisplay.Body>
</ToolDisplay>
```

#### `<ToolCallRequestDisplay>` and `<ToolCallResultDisplay>`

Event-aware wrappers. Look up the right specialized display from the registry and pass the request- or result-side data into it.

```tsx
<ToolCallRequestDisplay event={toolCallEvent} defaultExpanded={false} />
<ToolCallResultDisplay event={toolResultEvent} defaultExpanded={false} />
```

- **Merged display by default in chat mode.** When both request and result exist, render as a single collapsible card: header shows tool name + status + summary; expanding reveals input *and* output stacked vertically. This is what users actually want — one click to see "what was asked" and "what came back" together.
- **Separate timeline items in devtool mode.** Request and result render as distinct events with full timestamps. Useful for inspecting timing, retries, and out-of-order arrivals.
- Configurable per-instance via `mergedDisplay={true|false}`.
- Status-aware: pending/running/complete/error treatments. Errors expand by default so the user sees what went wrong without having to click.

#### `<CompactionDisplay>`

```tsx
<CompactionDisplay event={event} defaultExpanded={false} />
```

- **Always collapsed by default.** Shows as a horizontal divider with a brief summary ("12 earlier messages summarized — saved 8.4k tokens").
- Click to expand: full summary text via `<MarkdownDisplay>`, list of compacted event IDs (clickable in devtool mode to jump to them if still visible), before/after token counts.

#### `<SystemMessageDisplay>`, `<ErrorDisplay>`, `<CitationDisplay>`

- `SystemMessageDisplay`: hidden by default in chat mode; full prompt visible in devtool mode.
- `ErrorDisplay`: error message + optional retry button + collapsed stack trace.
- `CitationDisplay`: numbered superscript with hover preview; click for full source card.

### 6.3 Container components

#### `<ConversationView>`

The root component. Provides context for mode, tool registry, and the event store.

```tsx
<ConversationView
  events={events}                        // or use `transport` + `adapter`
  mode="chat"                            // 'chat' | 'devtool'
  toolDisplays={{
    read_file: IOToolDisplay,
    write_file: IOToolDisplay,
    str_replace: DiffToolDisplay,
    grep: GrepToolDisplay,
    glob: GlobToolDisplay,
    bash: BashToolDisplay,
    web_search: WebSearchToolDisplay,
  }}
  fallbackToolDisplay={DefaultToolDisplay}
  components={{                          // override any secondary component
    UserMessage: MyCustomUserMessage,
    AssistantMessage: MyCustomAssistantMessage,
  }}
  onEventClick={(event) => { /* … */ }}  // optional
>
  {/* default rendering, or compose your own */}
</ConversationView>
```

Two ways to use it:

**Default rendering.** No children — `<ConversationView events={events} />` renders the full transcript with sensible defaults.

**Composed rendering.** Pass children to fully control layout. The context is still available, so child components like `<EventList>` work without prop-drilling.

```tsx
<ConversationView events={events} mode="devtool">
  <Sidebar>
    <ConversationMetadata />
    <EventTypeFilter />
  </Sidebar>
  <Main>
    <EventList />               {/* renders the events */}
    <ScrollToBottom />
  </Main>
</ConversationView>
```

#### `<EventList>`

Renders events in order, dispatching to the right component per event type. Looks up tool displays in the registry. Handles streaming subscriptions efficiently (only the affected event re-renders on a delta).

#### `<ScrollAnchor>` and `<ScrollToBottom>`

Auto-scroll to latest event with the standard "user scrolled up — pause auto-scroll, show jump-to-bottom button" behavior.

### 6.4 Optional input components

Not core to the library but useful for getting started. Live in a separate entry point.

- `<MessageInput>` — text area with send button, attachment support, slash-command hooks.
- `<StopButton>` — cancels the in-flight request.
- `<RegenerateButton>` — re-runs the last assistant turn.

These wire into a `useConversation()` hook that exposes `send()`, `stop()`, `regenerate()`.

---

## 7. Collapsibility and overflow behavior

Long agentic transcripts are unreadable without aggressive collapsing. A 50-turn session with 30 tool calls — each potentially returning kilobytes of file content, search results, or shell output — turns into a 30,000-pixel scroll-fest if every component renders fully expanded. This section is the contract for how every component handles long content.

### 7.1 The two mechanisms

We use two distinct mechanisms, and it matters which one applies where:

- **Scroll containment** (`maxHeight` + overflow:auto). The component takes a fixed height; oversized content scrolls *inside* it. The component's footprint in the parent is bounded. Use for: tool result bodies, long code blocks inside an expanded section, lightboxed images, anything where the user has already opted into seeing the content.
- **Collapse / expand** (header visible, body hidden). The component shrinks to a header-only summary; clicking expands the body. The decision to render the content is gated on a click. Use for: tool calls/results in the timeline, thinking blocks, system messages, compaction events, errors with stack traces, anything where most users most of the time don't need to see it.

The two compose: an expanded `<ToolDisplay>` body uses scroll containment for its inner `<CodeDisplay>` — so even when expanded, the tool result doesn't grow unbounded.

### 7.2 Defaults by mode and component

| Component | Chat mode | Devtool mode | Notes |
|---|---|---|---|
| `UserMessage` | Unbounded | Unbounded | Collapsible opt-in for long pastes. |
| `AssistantMessage` | Unbounded | Unbounded | Always shown fully — it's the answer. |
| `ThinkingDisplay` | Collapsed | Expanded | Pill in chat, full in devtool. |
| `ToolCallRequestDisplay` | Collapsed (merged with result) | Expanded (separate from result) | The big one. |
| `ToolCallResultDisplay` | Collapsed (merged with request) | Expanded (separate from request) | Errors auto-expand in both modes. |
| `CompactionDisplay` | Collapsed | Collapsed | Divider only. |
| `SystemMessageDisplay` | Hidden | Expanded | System prompts hidden in product UIs. |
| `ErrorDisplay` | Expanded (message), collapsed (stack) | Fully expanded | Users always see the error message. |
| `CitationDisplay` | Inline superscript | Inline superscript + sidebar | Hover preview either way. |

Every default is overridable per-instance via `defaultExpanded` / `expanded` props.

### 7.3 The collapsed header contract

Every collapsible secondary component has a header that follows the same pattern, so the timeline is scannable:

```
[icon] [name/title]                    [summary one-liner]                [status] [duration] [⌄]
```

Examples:

```
🔧  read_file                            src/components/Button.tsx          ✓  142ms  ⌄
🔧  bash                                 npm install react                  ✓  3.2s   ⌄
🔧  grep                                 "useState" in src/                  ✓  18 hits ⌄
🧠  thinking                             Considering edge cases for...      ✓  12s    ⌄
✂️  compaction                           12 messages → 380 tokens           —        ⌄
⚠️  error                                Network request failed              ✗        ⌄
```

The summary is generated by the component (variants override). It's a single line, truncated with ellipsis. This is what makes the collapsed view *useful* rather than just compact — you can read the timeline without expanding anything and still know what happened.

### 7.4 Content-size handling

Each primary component takes a `maxHeight` prop with a sensible default:

| Primary | Default maxHeight | Collapsible by default | Notes |
|---|---|---|---|
| `CodeDisplay` | 400px | when content exceeds 400px | Fade-out gradient + "Expand" affordance. |
| `MarkdownDisplay` | unbounded | no | Set explicitly when used inside tool bodies. |
| `DiffViewer` | 500px | yes for large diffs | Auto-collapses unchanged regions GitHub-style. |
| `ImageDisplay` | 400px | n/a (lightbox instead) | Click to expand to full-size modal. |

Tool variants pass appropriate `maxHeight` values when composing primaries inside their bodies. For example, `BashToolDisplay` might cap stdout at 300px and stderr at 200px, both scrollable inside.

### 7.5 Bulk controls

Two convenience APIs on `<ConversationView>` and `<EventList>`:

```tsx
<ConversationView
  events={events}
  defaultExpansion="auto"     // 'auto' | 'collapsed' | 'expanded'
/>
```

- `'auto'` (default) — uses per-component defaults from §7.2.
- `'collapsed'` — collapses every collapsible component. Useful for devtools rendering very long runs.
- `'expanded'` — expands everything. Useful for printing or full-export views.

Plus an imperative API via the store:

```tsx
const { expandAll, collapseAll, expand, collapse } = useEventStore();
```

`expand(eventId)` and `collapse(eventId)` let consumers build "expand all errors" or "collapse all completed tool calls" controls.

### 7.6 Expansion state lives in the store

Expansion is conversation state, not component state. This matters because:

- Re-rendering the conversation (new event arrives, scroll jumps) shouldn't reset what the user has expanded.
- Consumers can persist expansion state across reloads if they want.
- Devtool features like "expand all" need a single source of truth.

Each event has an `expanded?: boolean` field in the store (separate from the event's own data). Components read it via `useEvent(id)` and write it via the store actions above. Default values come from §7.2.

### 7.7 Streaming and expansion

While a tool call is `streaming`, expand it by default in chat mode too — the user is watching it happen and collapsing mid-stream is jarring. On `complete`, collapse it after a short delay (configurable, default 1.5s) so the timeline returns to scannable. On `error`, leave it expanded.

This is implemented as a state machine in the wrapper components, not ad-hoc per consumer.

---

## 8. Customization model

Three levels, in order of escalation.

### Level 1 — Mode + verbosity

```tsx
<ConversationView mode="chat" />        // minimal everywhere
<ConversationView mode="devtool" />     // verbose everywhere
```

Per-component override:

```tsx
<ToolCallRequestDisplay event={event} verbosity="verbose" />
```

### Level 2 — Component override

Replace any component via the registry:

```tsx
<ConversationView
  components={{
    UserMessage: MyUserMessage,
    AssistantMessage: MyAssistantMessage,
  }}
  toolDisplays={{
    my_custom_tool: MyCustomToolDisplay,
  }}
/>
```

Custom components receive the same props as defaults. They can opt into the context (`useMode()`, `useEventStore()`) or ignore it.

### Level 3 — Slot composition

Build the layout from primitives:

```tsx
<ConversationView events={events}>
  <CustomHeader />
  <EventList
    renderEvent={(event) => {
      if (event.type === 'tool_call') return <MyToolDisplay event={event} />;
      return <DefaultEventRenderer event={event} />;
    }}
  />
  <CustomFooter />
</ConversationView>
```

---

## 9. Theming and styling

### 9.1 Tailwind + shadcn-style

- All components use Tailwind utility classes via `class-variance-authority` for variants.
- Components ship as raw `.tsx` files in a registry; consumers run `npx shadcn add` (against our registry) to copy them into their repo.
- The `cn()` utility (Tailwind merge) is included; consumers can override any class via a `className` prop.
- Dark mode via Tailwind's `dark:` variant, controlled by the consumer's existing setup.

### 9.2 Design tokens

CSS variables for colors, spacing, radii, fonts. Consumers override at any level (root, container, component). Default theme matches shadcn/ui defaults.

```css
:root {
  --conversation-bg: hsl(0 0% 100%);
  --conversation-border: hsl(240 5.9% 90%);
  --conversation-muted: hsl(240 4.8% 95.9%);
  --tool-pending: hsl(48 96% 53%);
  --tool-running: hsl(217 91% 60%);
  --tool-complete: hsl(142 71% 45%);
  --tool-error: hsl(0 84% 60%);
  /* … */
}
```

### 9.3 Icons

`lucide-react`. Consumers can override every icon via the registry pattern.

---

## 10. Package structure

Monorepo with two published packages and a registry.

```
agentflow           (published to npm)
├── src/
│   ├── types/                   # event format, schemas
│   ├── store/                   # in-memory store + reducer
│   ├── transports/              # http, websocket, memory
│   ├── adapters/                # openai, anthropic, agui, identity
│   ├── hooks/                   # useConversation, useEvent, useMode
│   └── index.ts

agentflow          (published to npm)
├── src/
│   ├── primitives/              # CodeDisplay, MarkdownDisplay, DiffViewer, ImageDisplay
│   ├── context/                 # ConversationView, providers
│   ├── components/              # UserMessage, AssistantMessage, ToolDisplay, etc.
│   └── index.ts

registry/                        (served via static URL, shadcn-compatible)
├── registry.json
├── styles/
└── components/                  # raw .tsx files for copy-paste
```

### 10.1 Build

- Core: `tsup` → ESM + CJS + `.d.ts`.
- React: `tsup` → ESM + CJS + `.d.ts`. Peer deps: `react >= 18`.
- Registry: static JSON manifest served from a CDN or GitHub Pages.

---

## 11. Dependencies

### Core (`agentflow`)

- No required runtime deps. (Adapters are pure functions; transports use platform `fetch` / `WebSocket`.)

### React (`agentflow`)

| Dep | Purpose | Notes |
|---|---|---|
| `react`, `react-dom` | — | peer dep, >= 18 |
| `@radix-ui/react-collapsible` | expand/collapse | |
| `@radix-ui/react-dialog` | lightbox, modals | |
| `@radix-ui/react-tooltip` | citation hovers | |
| `class-variance-authority` | variants | |
| `clsx`, `tailwind-merge` | `cn()` utility | |
| `lucide-react` | icons | |
| `react-markdown` | markdown | |
| `remark-gfm` | GFM extensions | |
| `shiki` | syntax highlighting | lazy-loaded grammars |
| `diff` | diff computation | |

### Optional (lazy-loaded)

- `remark-math` + `rehype-katex` — math rendering.
- `@tanstack/react-virtual` — virtualization for very long conversations.

---

## 12. Testing strategy

- **Unit:** Vitest for core (adapters, store, transports). Fixture-based tests for adapters: capture real chunk streams from each provider, assert deltas.
- **Component:** Vitest + Testing Library. Each component tested in isolation with synthetic events.
- **Visual:** Storybook with Chromatic (or Ladle) for visual regression. One story per component per mode (chat / devtool) per status (pending / streaming / complete / error).
- **Integration:** A demo app with mock transports replaying recorded sessions from OpenAI, Anthropic, and AG-UI.
- **Type:** `tsc --noEmit` in CI; `tsd` for type-level assertions on public APIs.

---

## 13. Documentation

Docs site (Nextra or similar). Sections:

1. **Getting started** — install, render a conversation in 10 lines.
2. **Concepts** — the four layers, the event format, why we don't use raw provider formats.
3. **Components reference** — every component, every prop, live examples.
4. **Customization** — three levels, with copy-paste examples.
5. **Adapters** — built-in adapters, writing a custom adapter.
6. **Transports** — built-in transports, writing a custom transport.
7. **Recipes** — common patterns: chat UI, devtool inspector, side-by-side replay, slash commands, human-in-the-loop approval.
8. **Migration** — from assistant-ui, from raw provider streams, from custom in-house solutions.

---

## 14. Build plan

A single-version build, not a phased release. Phases below are *build order* — what to implement first so each piece unblocks the next. Everything ships together.

### Phase 1 — Foundation

- Event format and types (§3).
- Core store + reducer with expansion state (§7.6).
- HTTP/SSE transport (§4.1).
- OpenAI adapter, streaming (§5).
- `CodeDisplay`, `MarkdownDisplay` primitives.
- `UserMessage`, `AssistantMessage` (no tool calls yet).
- `ConversationView` container with mode context.

**Done when:** a streaming OpenAI conversation renders end-to-end with markdown and code blocks.

### Phase 2 — Tool calls and collapsibility

- `DiffViewer`, `ImageDisplay` primitives.
- `ToolDisplay` base with slot API (`Header`, `Summary`, `Body`).
- Variants: `IOToolDisplay`, `GrepToolDisplay`, `GlobToolDisplay`, `BashToolDisplay`, `WebSearchToolDisplay`.
- `ToolCallRequestDisplay`, `ToolCallResultDisplay` with merged display.
- Tool registry on `ConversationView`.
- Full collapsibility model (§7): mode-aware defaults, per-variant header summaries, streaming → complete auto-collapse, bulk expand/collapse APIs.

**Done when:** a 50-turn agent run with 30 tool calls renders to a scannable timeline that fits in ~2 screens collapsed (success criterion §16).

### Phase 3 — Multi-provider support

- Anthropic adapter (streaming, including thinking blocks and content block model).
- AG-UI adapter.
- `ThinkingDisplay`, `CompactionDisplay`.

**Done when:** the same conversation can be replayed from OpenAI, Anthropic, and AG-UI fixture streams and renders identically.

### Phase 4 — WebSockets and remaining components

- WebSocket transport with resumability (§4.2).
- `SystemMessageDisplay`, `ErrorDisplay`, `CitationDisplay`.
- Optional input components: `MessageInput`, `StopButton`, `RegenerateButton`.

### Phase 5 — Distribution

- Shadcn registry published (raw `.tsx` files via `registry.json`).
- Storybook with one story per component per mode per status.
- Docs site (§13).
- Split-screen chat-mode/devtool-mode demo — the marketing piece.

### Phase 6 — Hardening

- Performance pass: virtualization for long conversations, memoization audit, bundle size against the budget.
- Accessibility audit (keyboard nav, ARIA, screen reader pass).
- Full fixture coverage for all three adapters.

### Out of scope for this build

These are real ideas but not part of the initial library. Revisit after it's in use.

- Replay/scrubbing UI for devtool mode.
- Run comparison view (diff two runs side-by-side).
- Persistence adapters (IndexedDB, localStorage).
- React Native port.
- Vue/Svelte ports of the core.

---

## 15. Open questions

- **Naming.** Package name and component naming convention (`<ToolDisplay>` vs `<ToolDisplay.Default>`). Decide before writing code.
- **Event ID generation.** Adapter-provided, or core generates if absent? Probably both: prefer upstream, fall back to UUID.
- **Multi-thread / branched conversations.** `parentId` is in the schema but not heavily used. Worth deeper design before depending on it.
- **Tool registration syntax.** Object map vs `registerTool()` calls vs JSX-based (`<ConversationView><ToolRegistry>...</ToolRegistry></ConversationView>`). Object map is simplest; revisit if it's clunky.
- **Bundle size targets.** Set explicit budgets for the React package. Probably <50kb gzipped for the core component set, with Shiki and react-markdown lazy-loaded.
- **AG-UI compatibility.** AG-UI is young and evolving; pin to a specific revision and document the supported event subset.

---

## 16. Success criteria

- A new user can render a streaming OpenAI conversation in under 10 lines of code.
- The same `events` array renders coherently in `mode="chat"` and `mode="devtool"` with no code changes.
- A consumer can replace any component in the registry without forking the library.
- A consumer can write a custom adapter for a proprietary backend in under 100 lines.
- Bundle size stays within budget; cold-start render of a 100-event conversation is under 100ms on a mid-tier laptop.
- **A 50-turn agent run with 30 tool calls renders to a scannable timeline that fits in roughly two screens** without the user expanding anything — the collapsed-header summaries tell the story.
- **Expansion state survives** new event arrivals, auto-scroll, and mode switches.
- The split-screen chat/devtool demo makes the value prop obvious in under 30 seconds.
