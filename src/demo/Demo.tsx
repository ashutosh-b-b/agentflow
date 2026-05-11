import { useState, useEffect } from "react";
import {
  CodeDisplay,
  MarkdownDisplay,
  DiffViewer,
  ImageDisplay,
} from "../primitives";
import {
  AssistantMessage,
  ConversationView,
  ToolCallRequestDisplay,
  ToolCallResultDisplay,
  UserMessage,
} from "../components";
import { openAIToEvents, type OpenAIMessage } from "../adapters/openai";
import conversation from "./conversation.json";
import type { ConversationEvent } from "../types/events";
import {
  callBadRead,
  callBash,
  callGlob,
  callGrep,
  callRead,
  callReplace,
  callSearch,
  resultBadRead,
  resultBashFail,
  resultGlob,
  resultGrep,
  resultRead,
  resultReplace,
  resultSearch,
  sampleAssistant1,
  sampleAssistantStreaming,
  sampleUser1,
  sampleUserLong,
} from "./sampleEvents";

const PYTHON_SAMPLE = `from dataclasses import dataclass

# highlight: outliers handled here
@dataclass
class Sample:
    id: int
    score: float
    label: str | None

def load(path: str) -> list[Sample]:
    with open(path) as f:
        return [Sample(**row) for row in json.load(f)]
`;

const TSX_LONG = `import { useState, useEffect } from "react";
import { Conversation } from "@agentflow/core";

export function App() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const transport = createHttpTransport({ url: "/api/chat" });
    const adapter = createOpenAIAdapter();
    transport.onChunk((chunk) => {
      const deltas = adapter.ingest(chunk);
      apply(deltas);
    });
    transport.connect();
    return () => transport.disconnect();
  }, []);

  function apply(deltas: EventDelta[]) {
    setEvents((prev) => reduce(prev, deltas));
  }

  return <Conversation events={events} />;
}

function createHttpTransport(opts: { url: string }) {
  // ...
  return {
    connect: async () => {},
    disconnect: async () => {},
    onChunk: (_h: (c: unknown) => void) => () => {},
  };
}

function createOpenAIAdapter() {
  return { reset: () => {}, ingest: (_c: unknown) => [], finalize: () => [] };
}

function reduce(prev: Event[], deltas: EventDelta[]): Event[] {
  let out = prev;
  for (const d of deltas) out = step(out, d);
  return out;
}

function step(prev: Event[], delta: EventDelta): Event[] {
  switch (delta.kind) {
    case "create": return [...prev, delta.event];
    case "append": return prev.map(e => e.id === delta.id ? { ...e, [delta.field]: (e as any)[delta.field] + delta.chunk } : e);
    case "patch": return prev.map(e => e.id === delta.id ? { ...e, ...delta.patch } : e);
    case "status": return prev.map(e => e.id === delta.id ? { ...e, status: delta.status } : e);
  }
}

type Event = { id: string; status: string };
type EventDelta =
  | { kind: "create"; event: Event }
  | { kind: "append"; id: string; field: string; chunk: string }
  | { kind: "patch"; id: string; patch: Partial<Event> }
  | { kind: "status"; id: string; status: string };
`;

const JSON_SAMPLE = `{
  "name": "agentflow",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "react": "^18.3.1",
    "highlight.js": "^11.11.1"
  }
}
`;

const PLAIN_LOG = `Server starting on :8080
[INFO] Connected to database
[INFO] Loaded 412 routes
[WARN] Rate limit on /api/sync set to 60/min
[INFO] Listening for connections
`;

const MD_SAMPLE = `## Refactor plan

The data layer currently mixes \`fetch\` calls with state. We'll split this into [three concerns](#) and keep the public API stable.

### Steps

- Extract a \`useResource\` hook
- Move serialization into \`./serde\`
- Add a \`RetryPolicy\` wrapper for transient failures

| Module | Before | After |
|---|---|---|
| \`api/index.ts\` | 412 LOC | 140 LOC |
| \`hooks/useResource.ts\` | — | 180 LOC |
| \`serde/index.ts\` | — | 92 LOC |

> Keep the public exports of \`api/index.ts\` stable — call sites won't change.

\`\`\`typescript
export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => { fetch(url).then(r => r.json()).then(setData); }, [url]);
  return data;
}
\`\`\`
`;

const MD_LONG = `## Long-form note

${"This paragraph repeats to demonstrate bounded scrolling. ".repeat(40)}

### Section two

${"More content. ".repeat(80)}

\`\`\`bash
$ npm install
$ npm run build
\`\`\`
`;

const OLD_TS = `export class ApiClient {
  constructor(private baseUrl: string) {}

  async ping() {
    return "ok";
  }

  async slowOp() {
    await new Promise(r => setTimeout(r, 100));
  }

  async noop() {}

  async greet(name: string) {
    return "hello " + name;
  }

  async log(msg: string) {
    console.log(msg);
  }

  async fetch(path: string) {
    const r = await fetch(this.baseUrl + path);
    return r.json();
  }
}
`;

const NEW_TS = `export class ApiClient {
  constructor(private baseUrl: string) {}

  async ping() {
    return "ok";
  }

  async slowOp() {
    await new Promise(r => setTimeout(r, 100));
  }

  async noop() {}

  async greet(name: string) {
    return "hello " + name;
  }

  async log(msg: string) {
    console.log(msg);
  }

  async fetch(path: string) {
    const r = await this.retry(() => fetch(this.baseUrl + path));
    if (!r.ok) throw new ApiError(r.status, path);
    return r.json() as Promise<unknown>;
  }
}
`;

const NEW_FILE = `import { useState } from "react";

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  return [on, () => setOn(o => !o)] as const;
}
`;

// 4×4 indigo PNG so the lightbox sample renders something visible.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAAXNSR0IArs4c6QAAACpJREFUOE9jZGBg+M+ABjAAFGzCFGbAYBoFRgFGgVGAVDAaCkYDgVEAANUKBgWmrM4MAAAAAElFTkSuQmCC";

export function Demo() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="page">
      <header className="doc-head">
        <div>
          <h1>Primary components</h1>
          <div className="sub">
            React implementations of the four primaries — rendered against the
            Agentflow design tokens.
          </div>
        </div>
        <div className="theme-switch">
          <button
            className={theme === "dark" ? "active" : ""}
            onClick={() => setTheme("dark")}
          >
            dark
          </button>
          <button
            className={theme === "light" ? "active" : ""}
            onClick={() => setTheme("light")}
          >
            light
          </button>
        </div>
      </header>

      <section>
        <div className="sec-head">
          <span className="sec-num">6.1</span>
          <h2 className="sec-title">Primary components</h2>
          <span className="sec-sub">pure renderers · no event awareness</span>
        </div>

        {/* CodeDisplay */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;CodeDisplay&gt;</span>
            <span className="spec-tag">primary</span>
            <span className="spec-desc">
              Bounded code block · highlight.js syntax tokens · line numbers ·
              line highlight + copy · collapsible w/ fade
            </span>
          </div>
          <div className="spec-body">
            <div className="grid c2">
              <div>
                <div className="vlabel">default · highlight 3, 7</div>
                <CodeDisplay
                  value={PYTHON_SAMPLE}
                  language="python"
                  filename="analyze.py"
                  highlightLines={[3, 7]}
                />
              </div>
              <div>
                <div className="vlabel">collapsible · clamp 120px</div>
                <CodeDisplay
                  value={TSX_LONG}
                  language="tsx"
                  filename="App.tsx"
                  collapsible
                  collapsedHeight={120}
                />
              </div>
              <div>
                <div className="vlabel">json · no line numbers</div>
                <CodeDisplay
                  value={JSON_SAMPLE}
                  language="json"
                  filename="package.json"
                  showLineNumbers={false}
                />
              </div>
              <div>
                <div className="vlabel">no language · plain text</div>
                <CodeDisplay
                  value={PLAIN_LOG}
                  filename="server.log"
                  copyable={false}
                />
              </div>
            </div>
          </div>
          <div className="spec-foot">
            <span><b>value</b> string</span><span><b>language</b> string</span>
            <span><b>showLineNumbers</b> bool=true</span><span><b>highlightLines</b> number[]</span>
            <span><b>maxHeight</b> px=400</span><span><b>collapsible</b> bool</span>
            <span><b>collapsedHeight</b> px=120</span><span><b>copyable</b> bool=true</span>
          </div>
        </article>

        {/* MarkdownDisplay */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;MarkdownDisplay&gt;</span>
            <span className="spec-tag">primary</span>
            <span className="spec-desc">
              react-markdown + GFM · fenced code routes through CodeDisplay ·
              safe by default
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="vlabel">unbounded (chat-typical)</div>
              <MarkdownDisplay value={MD_SAMPLE} />
            </div>
            <div>
              <div className="vlabel">bounded · maxHeight 200px (tool-output style)</div>
              <MarkdownDisplay value={MD_LONG} maxHeight={200} />
            </div>
            <div>
              <div className="vlabel">collapsible · 120px</div>
              <MarkdownDisplay value={MD_LONG} collapsible collapsedHeight={120} />
            </div>
          </div>
          <div className="spec-foot">
            <span><b>value</b> string</span>
            <span><b>components</b> overrides</span>
            <span><b>allowHtml</b> bool=false</span>
            <span><b>maxHeight</b> px|null</span>
            <span><b>collapsible</b> bool</span>
          </div>
        </article>

        {/* DiffViewer */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;DiffViewer&gt;</span>
            <span className="spec-tag">primary</span>
            <span className="spec-desc">
              Unified or split · auto-collapses unchanged regions · per-line
              add/del gutter
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="vlabel">unified · collapseUnchanged · contextLines 3</div>
              <DiffViewer
                oldValue={OLD_TS}
                newValue={NEW_TS}
                filename="src/api/client.ts"
                language="typescript"
                view="unified"
                contextLines={3}
              />
            </div>
            <div>
              <div className="vlabel">split view</div>
              <DiffViewer
                oldValue={OLD_TS}
                newValue={NEW_TS}
                filename="src/api/client.ts"
                language="typescript"
                view="split"
                contextLines={3}
              />
            </div>
            <div>
              <div className="vlabel">new file (oldValue empty)</div>
              <DiffViewer
                oldValue=""
                newValue={NEW_FILE}
                filename="src/hooks/useToggle.ts"
                language="typescript"
                view="unified"
              />
            </div>
          </div>
          <div className="spec-foot">
            <span><b>oldValue</b>/<b>newValue</b> string</span>
            <span><b>language</b> string</span>
            <span><b>view</b> 'unified'|'split'</span>
            <span><b>contextLines</b> int=3</span>
            <span><b>maxHeight</b> px=500</span>
            <span><b>collapseUnchanged</b> bool=true</span>
          </div>
        </article>

        {/* ImageDisplay */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;ImageDisplay&gt;</span>
            <span className="spec-tag">primary</span>
            <span className="spec-desc">
              Bounded image · click-to-expand lightbox · loading + error states · lazy
            </span>
          </div>
          <div className="spec-body">
            <div className="grid c2">
              <div>
                <div className="vlabel">loaded · lightbox enabled</div>
                <ImageDisplay
                  src={TINY_PNG}
                  alt="indigo block"
                  filename="screenshot.png"
                  sizeLabel="312 KB"
                  maxHeight={240}
                />
              </div>
              <div>
                <div className="vlabel">loaded · no metadata footer · no lightbox</div>
                <ImageDisplay
                  src={TINY_PNG}
                  alt="indigo block"
                  hideMeta
                  lightbox={false}
                  maxHeight={240}
                />
              </div>
              <div>
                <div className="vlabel">loading (static example)</div>
                <div className="ar-imgblock loading">
                  <div className="ph">loading…</div>
                </div>
              </div>
              <div>
                <div className="vlabel">error</div>
                <ImageDisplay
                  src="https://does-not-exist.invalid/missing.png"
                  alt="missing"
                  filename="missing.png"
                />
              </div>
            </div>
          </div>
          <div className="spec-foot">
            <span><b>src</b> string</span>
            <span><b>alt</b> string</span>
            <span><b>filename</b> string</span>
            <span><b>sizeLabel</b> string</span>
            <span><b>maxHeight</b> px=400</span>
            <span><b>lightbox</b> bool=true</span>
          </div>
        </article>
      </section>

      {/* ============== SECONDARIES ============== */}
      <section>
        <div className="sec-head">
          <span className="sec-num">6.2</span>
          <h2 className="sec-title">Secondary components</h2>
          <span className="sec-sub">event-aware · compose primaries</span>
        </div>

        {/* UserMessage */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;UserMessage&gt;</span>
            <span className="spec-tag">secondary</span>
            <span className="spec-desc">
              Right-aligned bubble · markdown · attachment chips · long-paste collapsible
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="vlabel">basic · pdf chip + image attachment</div>
              <UserMessage event={sampleUser1} />
            </div>
            <div>
              <div className="vlabel">long paste · collapsible 160px</div>
              <UserMessage event={sampleUserLong} collapsible collapsedHeight={160} />
            </div>
          </div>
          <div className="spec-foot">
            <span><b>event</b> UserMessageEvent</span>
            <span><b>name</b> string="you"</span>
            <span><b>maxHeight</b> px|null</span>
            <span><b>collapsible</b> bool</span>
          </div>
        </article>

        {/* AssistantMessage */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;AssistantMessage&gt;</span>
            <span className="spec-tag">secondary</span>
            <span className="spec-desc">
              Avatar + name · markdown body · streaming caret · inlined tool-call requests
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div className="vlabel">toolCallDisplay='full' (request cards)</div>
              <AssistantMessage
                event={sampleAssistant1}
                toolCalls={[callRead, callReplace]}
                toolCallDisplay="full"
              />
            </div>
            <div>
              <div className="vlabel">toolCallDisplay='name-only'</div>
              <AssistantMessage
                event={sampleAssistant1}
                toolCalls={[callRead, callReplace, callBash, callGrep]}
                toolCallDisplay="name-only"
              />
            </div>
            <div>
              <div className="vlabel">streaming · caret on the last paragraph</div>
              <AssistantMessage event={sampleAssistantStreaming} />
            </div>
          </div>
          <div className="spec-foot">
            <span><b>event</b> AssistantMessageEvent</span>
            <span><b>toolCalls</b> ToolCallEvent[]</span>
            <span><b>toolCallDisplay</b> 'full'|'name-only'|'none'</span>
          </div>
        </article>

        {/* Conversation flow — the canonical event ordering */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">conversation flow</span>
            <span className="spec-tag">composition</span>
            <span className="spec-desc">
              UserMessage → AssistantMessage (request cards inline) → ToolCallResult per call
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <UserMessage event={sampleUser1} />
            <AssistantMessage
              event={sampleAssistant1}
              toolCalls={[callRead, callReplace]}
              toolCallDisplay="full"
            />
            <ToolCallResultDisplay call={callRead} result={resultRead} defaultExpanded />
            <ToolCallResultDisplay call={callReplace} result={resultReplace} defaultExpanded />
            <AssistantMessage event={sampleAssistantStreaming} />
          </div>
        </article>

        {/* ToolCallRequestDisplay — request side */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;ToolCallRequestDisplay&gt;</span>
            <span className="spec-tag">request side</span>
            <span className="spec-desc">
              Renders only what the assistant asked for · routes via the tool-name registry
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="vlabel">read_file</div>
              <ToolCallRequestDisplay event={callRead} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">str_replace · IO variant routes through DiffViewer (the request *is* the diff)</div>
              <ToolCallRequestDisplay event={callReplace} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">bash</div>
              <ToolCallRequestDisplay event={callBash} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">grep · query in the header, no body</div>
              <ToolCallRequestDisplay event={callGrep} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">glob</div>
              <ToolCallRequestDisplay event={callGlob} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">web_search</div>
              <ToolCallRequestDisplay event={callSearch} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">unknown tool name · DefaultToolDisplay JSON dump</div>
              <ToolCallRequestDisplay
                event={{
                  id: "tc-x",
                  type: "tool_call",
                  status: "complete",
                  timestamp: 0,
                  toolCallId: "x",
                  toolName: "send_email",
                  input: { to: "ops@example.com", subject: "Heads up" },
                }}
                defaultExpanded
              />
            </div>
          </div>
          <div className="spec-foot">
            <span><b>event</b> ToolCallEvent</span>
            <span><b>variants</b> override map</span>
            <span><b>fallback</b> ToolVariantComponent</span>
          </div>
        </article>

        {/* ToolCallResultDisplay — result side (input + output) */}
        <article className="spec">
          <div className="spec-head">
            <span className="spec-name">&lt;ToolCallResultDisplay&gt;</span>
            <span className="spec-tag">result side</span>
            <span className="spec-desc">
              Standalone timeline event · shows what was asked + what came back
            </span>
          </div>
          <div className="spec-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="vlabel">read_file · output as code</div>
              <ToolCallResultDisplay call={callRead} result={resultRead} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">str_replace · diff in input, count in result</div>
              <ToolCallResultDisplay call={callReplace} result={resultReplace} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">bash · stdout + stderr · exit 1 → error tint</div>
              <ToolCallResultDisplay call={callBash} result={resultBashFail} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">grep · grouped result list with code snippets</div>
              <ToolCallResultDisplay call={callGrep} result={resultGrep} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">glob · path list with sizes</div>
              <ToolCallResultDisplay call={callGlob} result={resultGlob} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">web_search · result cards</div>
              <ToolCallResultDisplay call={callSearch} result={resultSearch} defaultExpanded />
            </div>
            <div>
              <div className="vlabel">errored · auto-expanded with error inset</div>
              <ToolCallResultDisplay call={callBadRead} result={resultBadRead} />
            </div>
          </div>
          <div className="spec-foot">
            <span><b>call</b> ToolCallEvent</span>
            <span><b>result</b> ToolResultEvent</span>
            <span><b>variants</b> override map</span>
          </div>
        </article>
      </section>

      {/* ============== CONVERSATION ============== */}
      <ConversationSection />
    </div>
  );
}

function ConversationSection() {
  const [mode, setMode] = useState<"chat" | "devtool" | "inspector">("chat");

  // Pending-permission overrides applied via Allow / Deny clicks in the demo.
  const [permissionOverrides, setPermissionOverrides] = useState<
    Record<string, "allowed" | "denied">
  >({});

  // OpenAI messages → normalized events. The fixture is in pure OpenAI Chat
  // Completions format; the adapter synthesizes timestamps and statuses.
  const baseEvents = openAIToEvents(conversation as OpenAIMessage[], {
    startTime: Date.parse("2026-05-04T12:00:00Z"),
    stepMs: 800,
    streamLast: true,
  });

  // Splice synthetic events into the timeline so the demo exercises every
  // secondary component (thinking / compaction / error / system_message).
  // Mark the bash call as a pending-permission gate so the Allow / Deny UX is
  // visible. Apply local Allow/Deny overrides on top so the demo clicks
  // update the rendered state.
  const events = injectSecondaryEvents(baseEvents).map((e) => {
    if (e.type !== "tool_call") return e;
    const override = permissionOverrides[e.toolCallId];
    if (override) return { ...e, permission: override };
    if (e.toolName === "bash") return { ...e, permission: "pending" as const };
    return e;
  });

  const description = (() => {
    switch (mode) {
      case "chat":
        return "Single column with chat-bubble alignment · AssistantMessage folds tool requests inline · ToolCallResult per call";
      case "devtool":
        return "Flat single column · no bubble alignment · request + result render as separate, expanded events · system messages visible";
      case "inspector":
        return "3-pane debug shell · filters · event-row table · raw JSON inspector for the selected event";
    }
  })();

  return (
    <section>
      <div className="sec-head">
        <span className="sec-num">6.3</span>
        <h2 className="sec-title">ConversationView</h2>
        <span className="sec-sub">
          OpenAI message JSON → adapter → normalized events → render
        </span>
        <div
          className="theme-switch"
          style={{ marginLeft: "auto" }}
        >
          <button
            className={mode === "chat" ? "active" : ""}
            onClick={() => setMode("chat")}
          >
            chat
          </button>
          <button
            className={mode === "devtool" ? "active" : ""}
            onClick={() => setMode("devtool")}
          >
            devtool
          </button>
          <button
            className={mode === "inspector" ? "active" : ""}
            onClick={() => setMode("inspector")}
          >
            inspector
          </button>
        </div>
      </div>

      <article className="spec">
        <div className="spec-head">
          <span className="spec-name">
            &lt;ConversationView mode="{mode}" /&gt;
          </span>
          <span className="spec-tag">composition</span>
          <span className="spec-desc">{description}</span>
        </div>
        <div className="spec-body" style={{ padding: 0 }}>
          <ConversationView
            events={events}
            mode={mode}
            showSearch
            onAllowToolCall={(id) =>
              setPermissionOverrides((p) => ({ ...p, [id]: "allowed" }))
            }
            onDenyToolCall={(id) =>
              setPermissionOverrides((p) => ({ ...p, [id]: "denied" }))
            }
            metadata={{
              title: "refactor src/api/client.ts",
              model: "claude-opus-4-7",
            }}
          />
        </div>
        <div className="spec-foot">
          <span>
            <b>events</b> {events.length} (from {conversation.length} OpenAI messages)
          </span>
          <span>
            <b>source</b> src/demo/conversation.json
          </span>
          <span>
            <b>adapter</b> openAIToEvents
          </span>
        </div>
      </article>
    </section>
  );
}

/**
 * Inject thinking / compaction / system_message / error events into the
 * adapter-generated stream so the demo timeline covers every secondary
 * component. Inserts:
 *
 *  - SystemMessage at the very start (the agent's system prompt)
 *  - Thinking before the first assistant message
 *  - Compaction halfway through (in front of the bash test)
 *  - Error at the end (idle-timeout style infra failure)
 */
function injectSecondaryEvents(events: ConversationEvent[]): ConversationEvent[] {
  const out: ConversationEvent[] = [];
  const t0 = events[0]?.timestamp ?? Date.now();

  // 1. System prompt at the start.
  out.push({
    id: "demo-sys-1",
    type: "system_message",
    status: "complete",
    timestamp: t0 - 100,
    content:
      "You are a careful, terse coding agent. Use the provided tools to read and modify the codebase. " +
      "Prefer minimal diffs. Always show the user the changes before writing them. " +
      "When uncertain, ask a clarifying question rather than guess. " +
      "Available tools: read_file, write_file, str_replace, grep, glob, bash, web_search.",
  });

  let firstAssistantSeen = false;
  let bashIndex = -1;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // 2. Thinking just before the first assistant message.
    if (!firstAssistantSeen && event.type === "assistant_message") {
      out.push({
        id: "demo-think-1",
        type: "thinking",
        status: "complete",
        timestamp: event.timestamp - 50,
        durationMs: 12_000,
        content:
          "The user wants stable public exports, so I should keep `ApiClient.fetch` as the entrypoint. " +
          "The retry wrapper can be a private helper. I need to be careful not to wrap idempotent assumptions " +
          "onto POST calls — let me check the call sites first to see what HTTP methods are in play. " +
          "If they're all GETs, the wrapper is straightforward.",
      });
      firstAssistantSeen = true;
    }

    // 3. Compaction immediately before the bash test step (where a long run
    //    would have rolled up earlier turns).
    if (
      bashIndex < 0 &&
      event.type === "tool_call" &&
      event.toolName === "bash"
    ) {
      bashIndex = i;
      out.push({
        id: "demo-compact-1",
        type: "compaction",
        status: "complete",
        timestamp: event.timestamp - 80,
        compactedEventIds: [
          "evt-1",
          "evt-2",
          "evt-3",
          "evt-4",
          "evt-5",
          "evt-6",
          "evt-7",
          "evt-8",
          "evt-9",
          "evt-10",
          "evt-11",
          "evt-12",
        ],
        tokensBefore: 14_230,
        tokensAfter: 5_830,
        summary:
          "User asked to refactor `src/api/client.ts` to add retries and a typed `ApiError`. " +
          "Agent read the file (412 LOC), located 3 call sites with grep, and applied a `str_replace` " +
          "that wraps the inner `fetch` in `this.retry(...)` and throws `ApiError` on non-2xx. " +
          "Public exports preserved. Now running the test suite to verify.",
      });
    }

    out.push(event);
  }

  // 4. An error event at the very end — e.g. an idle-timeout from a watcher
  //    after the failing test halted progress.
  const last = out[out.length - 1];
  out.push({
    id: "demo-err-1",
    type: "error",
    status: "error",
    timestamp: (last?.timestamp ?? t0) + 200,
    code: "idle_timeout",
    message: "Agent idle for 60s — no further events received",
    retryable: true,
    stack:
      "at watchOrchestratorIdle (src/runtime/watch.ts:42:11)\n" +
      "at Orchestrator.tick (src/runtime/orch.ts:108:9)\n" +
      "at processEvents (src/runtime/orch.ts:54:5)",
  });

  return out;
}
