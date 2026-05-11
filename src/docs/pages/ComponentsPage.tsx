import { useRef, useState } from "react";
import {
  CodeDisplay,
  DiffViewer,
  ImageDisplay,
  JsonDisplay,
  MarkdownDisplay,
} from "../../primitives";
import {
  AssistantMessage,
  CompactionDisplay,
  ConversationSearch,
  ConversationView,
  ErrorDisplay,
  ScrollToBottom,
  SystemMessageDisplay,
  ThinkingDisplay,
  ToolCallRequestDisplay,
  ToolCallResultDisplay,
  ToolCallsBundle,
  ToolDisplay,
  ToolPermissionProvider,
  UserMessage,
  useAutoScroll,
} from "../../components";
import type { ToolEventLike } from "../../components/tool-variants";
import {
  BashToolDisplay,
  DefaultToolDisplay,
  GlobToolDisplay,
  GrepToolDisplay,
  IOToolDisplay,
  WebSearchToolDisplay,
} from "../../components/tool-variants";
import type {
  AssistantMessageEvent,
  CompactionEvent,
  ConversationEvent,
  ErrorEvent,
  SystemMessageEvent,
  ThinkingEvent,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from "../../types/events";
import { ComponentCard, TierGroup } from "../components/ComponentCard";
import type { NavItem } from "../Sidebar";

export const COMPONENTS_NAV: NavItem[] = [
  { id: "comp-overview", label: "Overview", group: "Reference" },
  { id: "comp-primitives", label: "Primitives", group: "Tier 1 (pure)" },
  { id: "comp-messages", label: "Messages", group: "Tier 2 (event-aware)" },
  { id: "comp-specials", label: "Thinking · Compaction · Error · System", group: "Tier 2 (event-aware)" },
  { id: "comp-tools", label: "Tool layer", group: "Tier 2 (event-aware)" },
  { id: "comp-tool-variants", label: "Tool variants", group: "Tier 2 (event-aware)" },
  { id: "comp-container", label: "ConversationView", group: "Container" },
  { id: "comp-utilities", label: "Utilities", group: "Hooks & helpers" },
];

/* --------------------------------------------------------------------- *
 * Sample data shared across the cards
 * --------------------------------------------------------------------- */

const t0 = Date.parse("2026-05-04T12:00:00Z");
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAAXNSR0IArs4c6QAAACpJREFUOE9jZGBg+M+ABjAAFGzCFGbAYBoFRgFGgVGAVDAaCkYDgVEAANUKBgWmrM4MAAAAAElFTkSuQmCC";

const PYTHON_SAMPLE = `from dataclasses import dataclass

@dataclass
class Sample:
    id: int
    score: float
    label: str | None
`;

const MD_SAMPLE = `## Refactor plan

Three steps:

- Extract \`useResource\`
- Move serialization into \`./serde\`
- Add a \`RetryPolicy\` wrapper

> Keep the public exports stable.

\`\`\`ts
export function useResource<T>(url: string) {
  /* ... */
}
\`\`\`
`;

const OLD_TS = `export class ApiClient {
  async fetch(path: string) {
    const r = await fetch(this.baseUrl + path);
    return r.json();
  }
}
`;
const NEW_TS = `export class ApiClient {
  async fetch(path: string) {
    const r = await this.retry(() => fetch(this.baseUrl + path));
    if (!r.ok) throw new ApiError(r.status, path);
    return r.json() as Promise<unknown>;
  }
}
`;

const SAMPLE_USER: UserMessageEvent = {
  id: "u1",
  type: "user_message",
  status: "complete",
  timestamp: t0,
  content: "Refactor `src/api/client.ts` to add retries and surface a typed `ApiError`.",
  attachments: [
    { id: "a1", name: "spec.pdf", mimeType: "application/pdf", sizeBytes: 84_000 },
  ],
};

const SAMPLE_ASSISTANT: AssistantMessageEvent = {
  id: "a1",
  type: "assistant_message",
  status: "complete",
  timestamp: t0 + 1_200,
  content:
    "Got it — I'll wrap the inner `fetch` and rethrow non-2xx responses as `ApiError`.",
  finishReason: "tool_calls",
  usage: { inputTokens: 1280, outputTokens: 64 },
};

const SAMPLE_THINKING: ThinkingEvent = {
  id: "th1",
  type: "thinking",
  status: "complete",
  timestamp: t0 + 200,
  durationMs: 12_000,
  content:
    "The user wants stable public exports, so `ApiClient.fetch` stays as the entrypoint and the retry wrapper is private. I should be careful about idempotency on POST.",
};

const SAMPLE_COMPACTION: CompactionEvent = {
  id: "c1",
  type: "compaction",
  status: "complete",
  timestamp: t0 + 5_000,
  compactedEventIds: ["evt-1", "evt-2", "evt-3", "evt-4", "evt-5"],
  tokensBefore: 14_230,
  tokensAfter: 5_830,
  summary:
    "Earlier turns established the refactor goal: stable public exports, `ApiError` as a narrow typed exception, retry on networking failures.",
};

const SAMPLE_SYSTEM: SystemMessageEvent = {
  id: "s1",
  type: "system_message",
  status: "complete",
  timestamp: t0 - 100,
  content:
    "You are a careful, terse coding agent. Use the provided tools to read and modify the codebase. Prefer minimal diffs. Always show the user the changes before writing them.",
};

const SAMPLE_ERROR: ErrorEvent = {
  id: "e1",
  type: "error",
  status: "error",
  timestamp: t0 + 9_000,
  code: "idle_timeout",
  message: "Agent idle for 60s — no further events received",
  retryable: true,
  stack:
    "at watchOrchestratorIdle (src/runtime/watch.ts:42:11)\n" +
    "at Orchestrator.tick (src/runtime/orch.ts:108:9)",
};

const CALL_READ: ToolCallEvent = {
  id: "tc1",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 1_300,
  toolCallId: "call_read_1",
  toolName: "read_file",
  input: { path: "src/api/client.ts" },
};

const RESULT_READ: ToolResultEvent = {
  id: "tr1",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 1_442,
  toolCallId: "call_read_1",
  durationMs: 142,
  output: OLD_TS,
};

const CALL_REPLACE: ToolCallEvent = {
  id: "tc2",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 1_500,
  toolCallId: "call_replace_1",
  toolName: "str_replace",
  input: {
    path: "src/api/client.ts",
    old_str: "  async fetch(path: string) {\n    const r = await fetch(this.baseUrl + path);\n    return r.json();\n  }",
    new_str: "  async fetch(path: string) {\n    const r = await this.retry(() => fetch(this.baseUrl + path));\n    if (!r.ok) throw new ApiError(r.status, path);\n    return r.json() as Promise<unknown>;\n  }",
  },
};

const RESULT_REPLACE: ToolResultEvent = {
  id: "tr2",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 1_740,
  toolCallId: "call_replace_1",
  durationMs: 240,
  output: { replacements: 1 },
};

const CALL_WRITE: ToolCallEvent = {
  id: "tcw",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 1_800,
  toolCallId: "call_write_1",
  toolName: "write_file",
  input: {
    path: "src/api/errors.ts",
    content: `export class ApiError extends Error {
  constructor(public status: number, public path: string) {
    super(\`\${status} \${path}\`);
    this.name = "ApiError";
  }
}
`,
  },
};

const RESULT_WRITE: ToolResultEvent = {
  id: "trw",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 1_900,
  toolCallId: "call_write_1",
  durationMs: 100,
  output: { bytes_written: 184 },
};

const CALL_BASH: ToolCallEvent = {
  id: "tc3",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_000,
  toolCallId: "call_bash_1",
  toolName: "bash",
  input: { command: "npm test" },
};

const RESULT_BASH_FAIL: ToolResultEvent = {
  id: "tr3",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 6_200,
  toolCallId: "call_bash_1",
  durationMs: 4_200,
  output: {
    stdout: "PASS  src/parser.test.ts\nFAIL  src/api/client.test.ts\n",
    stderr: "  Expected ApiError, received TypeError",
    exitCode: 1,
  },
};

const CALL_GREP: ToolCallEvent = {
  id: "tc4",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_300,
  toolCallId: "call_grep_1",
  toolName: "grep",
  input: { pattern: "client.fetch", path: "src/" },
};
const RESULT_GREP: ToolResultEvent = {
  id: "tr4",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 2_384,
  toolCallId: "call_grep_1",
  durationMs: 84,
  output: {
    totalMatches: 3,
    totalFiles: 3,
    matches: [
      { file: "src/App.tsx", lines: [{ lineNo: 22, text: '  const data = await client.fetch("/api/items");' }] },
      { file: "src/services/sync.ts", lines: [{ lineNo: 41, text: "  const next = await client.fetch(`/api/sync`);" }] },
    ],
  },
};

const CALL_GLOB: ToolCallEvent = {
  id: "tc5",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_500,
  toolCallId: "call_glob_1",
  toolName: "glob",
  input: { pattern: "**/*.tsx" },
};
const RESULT_GLOB: ToolResultEvent = {
  id: "tr5",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 2_542,
  toolCallId: "call_glob_1",
  durationMs: 42,
  output: {
    files: [
      { path: "src/App.tsx", sizeBytes: 2_100 },
      { path: "src/components/Button.tsx", sizeBytes: 840 },
      { path: "src/hooks/useResource.tsx", sizeBytes: 920 },
    ],
    truncated: 21,
  },
};

const CALL_SEARCH: ToolCallEvent = {
  id: "tc6",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_700,
  toolCallId: "call_search_1",
  toolName: "web_search",
  input: { query: "react server components production" },
};
const RESULT_SEARCH: ToolResultEvent = {
  id: "tr6",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 3_900,
  toolCallId: "call_search_1",
  durationMs: 1_200,
  output: {
    results: [
      {
        title: "Server Components — react.dev",
        url: "https://react.dev/learn/server-components",
        snippet: "Render parts of your UI on the server, reducing client-side bundle size.",
      },
    ],
  },
};

const CALL_UNKNOWN: ToolCallEvent = {
  id: "tcU",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 4_000,
  toolCallId: "call_email_1",
  toolName: "send_email",
  input: { to: "ops@example.com", subject: "Heads up", body: "test failed" },
};
const RESULT_UNKNOWN: ToolResultEvent = {
  id: "trU",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 4_056,
  toolCallId: "call_email_1",
  durationMs: 56,
  output: { messageId: "msg_42" },
};

const SHORT_CONVERSATION: ConversationEvent[] = [
  SAMPLE_SYSTEM,
  SAMPLE_USER,
  SAMPLE_ASSISTANT,
  CALL_READ,
  RESULT_READ,
];

/* --------------------------------------------------------------------- *
 * Page
 * --------------------------------------------------------------------- */

export function ComponentsPage() {
  return (
    <>
      <Overview />
      <PrimitivesTier />
      <MessagesTier />
      <SpecialsTier />
      <ToolLayerTier />
      <ToolVariantsTier />
      <ContainerTier />
      <UtilitiesTier />
    </>
  );
}

function Overview() {
  return (
    <section id="comp-overview" className="docs-section">
      <header className="docs-section-head">
        <div className="docs-section-eyebrow">Reference</div>
        <h2 className="docs-section-title">Component reference</h2>
      </header>
      <div className="docs-prose">
        <p>
          Every exported component, grouped by tier and concern. Cards below
          carry a live preview, the key props, and a copy-pasteable usage
          snippet. Use the sidebar to jump between sections.
        </p>
        <p>
          <strong>Tiers:</strong> primitives are pure renderers (no event
          awareness); secondaries consume events and compose primitives;
          containers wire it all together. Utilities expose hooks and context
          providers for advanced compositions.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- *
 * Tier 1 — Primitives
 * --------------------------------------------------------------------- */

function PrimitivesTier() {
  return (
    <TierGroup
      id="comp-primitives"
      title="Primitives"
      description="Pure renderers. No knowledge of events, messages, or tools — reusable anywhere."
    >
      <ComponentCard
        id="comp-CodeDisplay"
        name="<CodeDisplay>"
        kind="primitive"
        description="Bounded code block with highlight.js syntax tokens, line numbers, line highlighting, copy button, and optional collapse."
        preview={
          <CodeDisplay
            value={PYTHON_SAMPLE}
            language="python"
            filename="sample.py"
            highlightLines={[3]}
          />
        }
        props={[
          { name: "value", type: "string", description: "Source text to render." },
          { name: "language", type: "string", description: "highlight.js language id (ts, tsx, py, json, bash, …)." },
          { name: "filename", type: "string", description: "Optional caption shown in the header." },
          { name: "showLineNumbers", type: "boolean", default: "true" },
          { name: "highlightLines", type: "number[]", description: "Line numbers (1-based) to tint." },
          { name: "maxHeight", type: "number", default: "400", description: "Pixels — content scrolls inside." },
          { name: "collapsible", type: "boolean", description: "When true, clamp + Expand bar." },
          { name: "copyable", type: "boolean", default: "true" },
        ]}
        code={`<CodeDisplay
  value={source}
  language="python"
  filename="sample.py"
  highlightLines={[3]}
/>`}
      />

      <ComponentCard
        id="comp-MarkdownDisplay"
        name="<MarkdownDisplay>"
        kind="primitive"
        description="react-markdown + GFM. Fenced code blocks route through CodeDisplay automatically."
        preview={<MarkdownDisplay value={MD_SAMPLE} />}
        props={[
          { name: "value", type: "string", description: "Markdown source." },
          { name: "components", type: "Components", description: "react-markdown per-element overrides." },
          { name: "allowHtml", type: "boolean", default: "false" },
          { name: "maxHeight", type: "number | null", description: "When set, content scrolls inside." },
          { name: "collapsible", type: "boolean", description: "Adds a Show more / Show less toggle when content overflows collapsedHeight." },
          { name: "collapsedHeight", type: "number", default: "200" },
        ]}
        code={`<MarkdownDisplay value={markdown} collapsible collapsedHeight={120} />`}
      />

      <ComponentCard
        id="comp-DiffViewer"
        name="<DiffViewer>"
        kind="primitive"
        description="Unified or split diff. Auto-collapses unchanged regions GitHub-style."
        preview={
          <DiffViewer
            oldValue={OLD_TS}
            newValue={NEW_TS}
            filename="src/api/client.ts"
            language="typescript"
          />
        }
        props={[
          { name: "oldValue", type: "string" },
          { name: "newValue", type: "string" },
          { name: "filename", type: "string" },
          { name: "language", type: "string" },
          { name: "view", type: "'unified' | 'split'", default: "'unified'" },
          { name: "contextLines", type: "number", default: "3" },
          { name: "collapseUnchanged", type: "boolean", default: "true" },
          { name: "maxHeight", type: "number", default: "500" },
        ]}
        code={`<DiffViewer
  oldValue={before}
  newValue={after}
  filename="src/api/client.ts"
  view="unified"
/>`}
      />

      <ComponentCard
        id="comp-ImageDisplay"
        name="<ImageDisplay>"
        kind="primitive"
        description="Bounded image with click-to-expand lightbox, plus loading + error states."
        preview={
          <div style={{ maxWidth: 320 }}>
            <ImageDisplay src={TINY_PNG} alt="indigo block" filename="screenshot.png" sizeLabel="312 KB" />
          </div>
        }
        props={[
          { name: "src", type: "string" },
          { name: "alt", type: "string" },
          { name: "filename", type: "string" },
          { name: "sizeLabel", type: "string" },
          { name: "maxHeight", type: "number", default: "400" },
          { name: "lightbox", type: "boolean", default: "true" },
        ]}
        code={`<ImageDisplay src={url} alt={description} maxHeight={240} />`}
      />

      <ComponentCard
        id="comp-JsonDisplay"
        name="<JsonDisplay>"
        kind="primitive"
        description="Real expandable JSON tree with collapse-by-depth, copy-by-path, and search-aware auto-expansion."
        preview={
          <JsonDisplay
            value={{
              orchestrator: { idleTimeoutMs: 60_000, retries: 3 },
              models: ["claude-opus-4-7", "gpt-4o"],
              flags: { strict: true, telemetry: false, debug: null },
            }}
            defaultExpandDepth={2}
          />
        }
        props={[
          { name: "value", type: "unknown", description: "Anything JSON.stringify-able." },
          { name: "defaultExpandDepth", type: "number", default: "1" },
          { name: "searchTerm", type: "string", description: "Highlights matching keys/values; auto-expands ancestors." },
          { name: "onCopyPath", type: "(path: string) => void", description: "Override default clipboard behavior." },
          { name: "maxHeight", type: "number" },
          { name: "maxStringPreview", type: "number", default: "200" },
        ]}
        code={`<JsonDisplay value={taskConfig} defaultExpandDepth={2} searchTerm={query} />`}
      />
    </TierGroup>
  );
}

/* --------------------------------------------------------------------- *
 * Tier 2 — Messages
 * --------------------------------------------------------------------- */

function MessagesTier() {
  return (
    <TierGroup
      id="comp-messages"
      title="Messages"
      description="The chat skeleton — user prompts and assistant responses."
    >
      <ComponentCard
        id="comp-UserMessage"
        name="<UserMessage>"
        kind="event-aware"
        description="Right-aligned bubble in the default 'bubble' variant; full-width with no decoration in 'flat'. Renders attachments inline (images via ImageDisplay, others as chips)."
        preview={<UserMessage event={SAMPLE_USER} />}
        props={[
          { name: "event", type: "UserMessageEvent" },
          { name: "name", type: "string", default: '"you"' },
          { name: "variant", type: "'bubble' | 'flat'", default: "'bubble'" },
          { name: "maxHeight", type: "number | null" },
          { name: "collapsible", type: "boolean", default: "false" },
        ]}
        code={`<UserMessage event={event} />
<UserMessage event={event} variant="flat" name="user" />`}
      />

      <ComponentCard
        id="comp-AssistantMessage"
        name="<AssistantMessage>"
        kind="event-aware"
        description="Avatar + name + meta header (bubble variant) or eyebrow-style (flat). Streaming caret on the last paragraph. In flat variant + non-empty toolCalls, renders a ToolCallsBundle below the text."
        preview={
          <AssistantMessage
            event={SAMPLE_ASSISTANT}
            toolCalls={[CALL_READ]}
          />
        }
        props={[
          { name: "event", type: "AssistantMessageEvent" },
          { name: "toolCalls", type: "ToolCallEvent[]", description: "Inlined as request cards (bubble) or in a ToolCallsBundle (flat)." },
          { name: "toolCallDisplay", type: "'full' | 'name-only' | 'none'", default: "'full'" },
          { name: "toolVariants", type: "Record<string, ToolVariantComponent>" },
          { name: "name", type: "string", default: '"Assistant"' },
          { name: "avatar", type: "ReactNode" },
          { name: "variant", type: "'bubble' | 'flat'", default: "'bubble'" },
        ]}
        code={`<AssistantMessage
  event={event}
  toolCalls={toolCalls}
  toolCallDisplay="full"
/>`}
      />
    </TierGroup>
  );
}

/* --------------------------------------------------------------------- *
 * Tier 2 — Specials (Thinking / Compaction / Error / SystemMessage)
 * --------------------------------------------------------------------- */

function SpecialsTier() {
  return (
    <TierGroup
      id="comp-specials"
      title="Thinking · Compaction · Error · System"
      description="Event-aware secondaries that aren't part of the user/assistant skeleton."
    >
      <ComponentCard
        id="comp-ThinkingDisplay"
        name="<ThinkingDisplay>"
        kind="event-aware"
        description="Lavender pill (collapsed) → expanded block with italic markdown body. Mode-aware default expansion."
        preview={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ThinkingDisplay event={SAMPLE_THINKING} />
            <ThinkingDisplay event={SAMPLE_THINKING} defaultExpanded />
          </div>
        }
        props={[
          { name: "event", type: "ThinkingEvent" },
          { name: "defaultExpanded", type: "boolean", default: "false" },
          { name: "expanded", type: "boolean", description: "Controlled mode." },
          { name: "onExpandedChange", type: "(expanded: boolean) => void" },
        ]}
        code={`<ThinkingDisplay event={thinkingEvent} defaultExpanded />`}
      />

      <ComponentCard
        id="comp-CompactionDisplay"
        name="<CompactionDisplay>"
        kind="event-aware"
        description="Collapsed: a horizontal divider with summary. Expanded: full summary markdown + clickable badges of compacted event ids."
        preview={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CompactionDisplay event={SAMPLE_COMPACTION} />
            <CompactionDisplay event={SAMPLE_COMPACTION} defaultExpanded />
          </div>
        }
        props={[
          { name: "event", type: "CompactionEvent" },
          { name: "defaultExpanded", type: "boolean", default: "false" },
          { name: "onEventIdClick", type: "(eventId: string) => void", description: "Wire this to your store to jump to a compacted event." },
        ]}
        code={`<CompactionDisplay event={event} onEventIdClick={(id) => store.scrollTo(id)} />`}
      />

      <ComponentCard
        id="comp-ErrorDisplay"
        name="<ErrorDisplay>"
        kind="event-aware"
        description="Coral surface · code + message · optional Retry · stack trace collapsed by default."
        preview={
          <ErrorDisplay event={SAMPLE_ERROR} onRetry={() => {}} />
        }
        props={[
          { name: "event", type: "ErrorEvent" },
          { name: "onRetry", type: "() => void", description: "Renders the Retry button when present and event.retryable !== false." },
          { name: "defaultStackExpanded", type: "boolean", default: "false" },
          { name: "inset", type: "boolean", description: "Tighter padding for use inside a tool body." },
        ]}
        code={`<ErrorDisplay event={errorEvent} onRetry={() => requeue(jobId)} />`}
      />

      <ComponentCard
        id="comp-SystemMessageDisplay"
        name="<SystemMessageDisplay>"
        kind="event-aware"
        description="Hidden / placeholder / full block — controlled by the display prop. Default 'block' shows SYSTEM eyebrow + token estimate + Copy + bounded-scroll body."
        preview={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SystemMessageDisplay event={SAMPLE_SYSTEM} display="placeholder" />
            <SystemMessageDisplay event={SAMPLE_SYSTEM} display="block" />
          </div>
        }
        props={[
          { name: "event", type: "SystemMessageEvent" },
          { name: "display", type: "'placeholder' | 'block' | 'hidden'", default: "'block'" },
          { name: "shaLabel", type: "string", description: "Optional content hash shown in the header." },
          { name: "bodyMaxHeight", type: "number", default: "240" },
          { name: "copyable", type: "boolean", default: "true" },
        ]}
        code={`<SystemMessageDisplay event={systemEvent} display="block" shaLabel="7a4f" />`}
      />
    </TierGroup>
  );
}

/* --------------------------------------------------------------------- *
 * Tier 2 — Tool layer (base + wrappers)
 * --------------------------------------------------------------------- */

function ToolLayerTier() {
  return (
    <TierGroup
      id="comp-tools"
      title="Tool layer"
      description="The base ToolDisplay (used by every variant) and the event-aware wrappers that route a tool_call / tool_result through the right variant."
    >
      <ComponentCard
        id="comp-ToolDisplay"
        name="<ToolDisplay>"
        kind="composition"
        description="Base layout: status-dot header (always visible) + collapsible body. Variants compose this. Header / Summary / Body slots for full layout overrides; Section helper for body sub-headings."
        preview={
          <ToolDisplay name="example_tool" status="complete" durationMs={142} summary="this is a summary" defaultExpanded>
            <ToolDisplay.Section label="Section A">
              <CodeDisplay value='{ "input": "value" }' language="json" showLineNumbers={false} copyable={false} />
            </ToolDisplay.Section>
            <ToolDisplay.Section label="Section B">
              <CodeDisplay value="output here" showLineNumbers={false} copyable={false} />
            </ToolDisplay.Section>
          </ToolDisplay>
        }
        props={[
          { name: "name", type: "string" },
          { name: "status", type: "ToolStatus", description: "'idle' | 'running' | 'complete' | 'error'." },
          { name: "durationMs", type: "number" },
          { name: "summary", type: "ReactNode", description: "One-line summary in the collapsed header." },
          { name: "defaultExpanded", type: "boolean" },
          { name: "expanded / onExpandedChange", type: "boolean / fn", description: "Controlled mode." },
          { name: "bodyMaxHeight", type: "number", default: "500" },
          { name: "permission", type: "'pending' | 'allowed' | 'denied'" },
          { name: "toolCallId", type: "string", description: "Required for permission Allow/Deny actions to fire." },
        ]}
        code={`<ToolDisplay name="bash" status="complete" durationMs={4200} summary="npm test">
  <ToolDisplay.Section label="$ command">
    <CodeDisplay value={cmd} language="bash" />
  </ToolDisplay.Section>
  <ToolDisplay.Section label="stdout">
    <CodeDisplay value={stdout} maxHeight={300} collapsible />
  </ToolDisplay.Section>
</ToolDisplay>`}
      />

      <ComponentCard
        id="comp-ToolCallRequestDisplay"
        name="<ToolCallRequestDisplay>"
        kind="event-aware"
        description="Renders only the input side of a tool_call. Routes through the registry by tool name; falls back to DefaultToolDisplay."
        preview={<ToolCallRequestDisplay event={CALL_REPLACE} defaultExpanded />}
        props={[
          { name: "event", type: "ToolCallEvent" },
          { name: "variants", type: "Record<string, ToolVariantComponent>", description: "Override / add tools by name." },
          { name: "fallback", type: "ToolVariantComponent", description: "Used when no entry matches event.toolName." },
          { name: "defaultExpanded", type: "boolean" },
        ]}
        code={`<ToolCallRequestDisplay
  event={toolCallEvent}
  variants={{ julia_eval: JuliaToolDisplay }}
/>`}
      />

      <ComponentCard
        id="comp-ToolCallResultDisplay"
        name="<ToolCallResultDisplay>"
        kind="event-aware"
        description="Renders the merged view (input + output) for a tool result event. Takes both the original call (for routing + context) and the result event."
        preview={<ToolCallResultDisplay call={CALL_REPLACE} result={RESULT_REPLACE} defaultExpanded />}
        props={[
          { name: "call", type: "ToolCallEvent" },
          { name: "result", type: "ToolResultEvent" },
          { name: "variants", type: "Record<string, ToolVariantComponent>" },
          { name: "fallback", type: "ToolVariantComponent" },
          { name: "defaultExpanded", type: "boolean" },
        ]}
        code={`<ToolCallResultDisplay call={callEvent} result={resultEvent} />`}
      />

      <ComponentCard
        id="comp-ToolCallsBundle"
        name="<ToolCallsBundle>"
        kind="event-aware"
        description='Collapsible "Tool Calls Requested" group. Used by AssistantMessage in flat variant. Header + chevron; collapsed body shows compact one-liners; expanded body shows full request cards.'
        preview={<ToolCallsBundle toolCalls={[CALL_READ, CALL_REPLACE, CALL_GREP]} />}
        props={[
          { name: "toolCalls", type: "ToolCallEvent[]" },
          { name: "toolVariants", type: "Record<string, ToolVariantComponent>" },
          { name: "defaultExpanded", type: "boolean", default: "false" },
          { name: "label", type: "string", default: '"Tool Calls Requested"' },
        ]}
        code={`<ToolCallsBundle toolCalls={[callA, callB, callC]} />`}
      />
    </TierGroup>
  );
}

/* --------------------------------------------------------------------- *
 * Tier 2 — Tool variants
 * --------------------------------------------------------------------- */

function ToolVariantsTier() {
  return (
    <TierGroup
      id="comp-tool-variants"
      title="Tool variants"
      description="Built-in renderers for the tools the registry knows by default. Each composes ToolDisplay and the relevant primitives. Anything not in the registry routes to DefaultToolDisplay."
    >
      <ComponentCard
        id="comp-IOToolDisplay"
        name="<IOToolDisplay>"
        kind="variant"
        description="Handles read_file, write_file, str_replace, show_image. The variant chooses the right inner primitive per tool: read_file → CodeDisplay (output content), write_file → CodeDisplay (written content), str_replace → DiffViewer (old_str → new_str)."
        preview={
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="vlabel" style={{ marginBottom: 6 }}>read_file</div>
              <IOToolDisplay event={mergeForResult(CALL_READ, RESULT_READ)} defaultExpanded />
            </div>
            <div>
              <div className="vlabel" style={{ marginBottom: 6 }}>write_file</div>
              <IOToolDisplay event={mergeForResult(CALL_WRITE, RESULT_WRITE)} defaultExpanded />
            </div>
            <div>
              <div className="vlabel" style={{ marginBottom: 6 }}>str_replace</div>
              <IOToolDisplay event={mergeForResult(CALL_REPLACE, RESULT_REPLACE)} defaultExpanded />
            </div>
          </div>
        }
        notes={
          <ul>
            <li>Detects language by file extension for syntax highlighting.</li>
            <li>read_file output (string) wraps in CodeDisplay; write_file shows the written content + bytes; str_replace shows the diff + replacement count.</li>
            <li>Aliased on read_file / write_file / str_replace / show_image.</li>
          </ul>
        }
        code={`// Already registered for read_file / write_file / str_replace / show_image.
// Re-register if you want to override:
<ConversationView toolVariants={{ str_replace: IOToolDisplay }} />`}
      />

      <ComponentCard
        id="comp-BashToolDisplay"
        name="<BashToolDisplay>"
        kind="variant"
        description="Renders the shell command + stdout + stderr + exit code. Non-zero exit retints the dot to error."
        preview={<BashToolDisplay event={mergeForResult(CALL_BASH, RESULT_BASH_FAIL)} defaultExpanded />}
        notes={
          <ul>
            <li>stdout / stderr both use CodeDisplay with bounded height + collapsible.</li>
            <li>Aliased on bash / shell / exec.</li>
          </ul>
        }
      />

      <ComponentCard
        id="comp-GrepToolDisplay"
        name="<GrepToolDisplay>"
        kind="variant"
        description="Grouped result list with code snippets per file. Pattern goes in the header summary."
        preview={<GrepToolDisplay event={mergeForResult(CALL_GREP, RESULT_GREP)} defaultExpanded />}
        notes={
          <ul>
            <li>Aliased on grep / search.</li>
          </ul>
        }
      />

      <ComponentCard
        id="comp-GlobToolDisplay"
        name="<GlobToolDisplay>"
        kind="variant"
        description="Path list with sizes + truncation row."
        preview={<GlobToolDisplay event={mergeForResult(CALL_GLOB, RESULT_GLOB)} defaultExpanded />}
        notes={<ul><li>Aliased on glob / find.</li></ul>}
      />

      <ComponentCard
        id="comp-WebSearchToolDisplay"
        name="<WebSearchToolDisplay>"
        kind="variant"
        description="Search-result cards: title, url, snippet."
        preview={<WebSearchToolDisplay event={mergeForResult(CALL_SEARCH, RESULT_SEARCH)} defaultExpanded />}
      />

      <ComponentCard
        id="comp-DefaultToolDisplay"
        name="<DefaultToolDisplay>"
        kind="variant"
        description="Fallback for unregistered tools — JSON dumps for input + output. The registry routes here whenever no entry matches event.toolName."
        preview={<DefaultToolDisplay event={mergeForResult(CALL_UNKNOWN, RESULT_UNKNOWN)} defaultExpanded />}
        notes={
          <ul>
            <li>If you see this on a tool you care about, write a custom variant — see <a href="#/docs#custom-tools">Custom tool displays</a>.</li>
          </ul>
        }
      />
    </TierGroup>
  );
}

/* --------------------------------------------------------------------- *
 * Container
 * --------------------------------------------------------------------- */

function ContainerTier() {
  return (
    <TierGroup
      id="comp-container"
      title="ConversationView"
      description="The root. Walks events, groups assistant turns with their tool calls, dispatches to the right component per event type, and provides the chat / devtool / inspector shells."
    >
      <ComponentCard
        id="comp-ConversationView"
        name="<ConversationView>"
        kind="container"
        description="Single-component entry point for rendering a conversation. Pass events; opt into search, custom variants, custom components, and permission handlers as needed."
        preview={<ConversationView events={SHORT_CONVERSATION} mode="chat" />}
        props={[
          { name: "events", type: "ConversationEvent[]" },
          { name: "mode", type: "'chat' | 'devtool' | 'inspector'", default: "'chat'" },
          { name: "metadata", type: "{ title?, model?, [k]?: unknown }" },
          { name: "toolVariants", type: "Record<string, ToolVariantComponent>" },
          { name: "components", type: "Partial<ConversationComponents>", description: "Override UserMessage / AssistantMessage / etc." },
          { name: "showSearch", type: "boolean", default: "false" },
          { name: "toolRequestDefaultExpanded", type: "boolean", description: "Override the mode default for ToolCallRequestDisplay cards. Undefined = auto (collapsed in chat, expanded in devtool)." },
          { name: "toolResultDefaultExpanded", type: "boolean", description: "Override the mode default for ToolCallResultDisplay cards. Pending-permission tool calls always auto-expand regardless." },
          { name: "onAllowToolCall", type: "(toolCallId: string) => void" },
          { name: "onDenyToolCall", type: "(toolCallId: string) => void" },
        ]}
        code={`<ConversationView
  events={events}
  mode="devtool"
  showSearch
  toolResultDefaultExpanded={false}     // collapse all results by default
  toolRequestDefaultExpanded={false}    // and requests
  toolVariants={{ julia_eval: JuliaToolDisplay }}
  components={{ AssistantMessage: BrandedAssistantMessage }}
  onAllowToolCall={(id) => store.allow(id)}
  onDenyToolCall={(id) => store.deny(id)}
  metadata={{ title, model }}
/>`}
      />
    </TierGroup>
  );
}

/* --------------------------------------------------------------------- *
 * Utilities — scroll + search + permission
 * --------------------------------------------------------------------- */

function UtilitiesTier() {
  return (
    <TierGroup
      id="comp-utilities"
      title="Utilities"
      description="Hooks and providers for advanced compositions. ConversationView wires these for you; only reach for them when you build your own layout."
    >
      <ComponentCard
        id="comp-useAutoScroll"
        name="useAutoScroll(ref, contentKey)"
        kind="hook"
        description="Live-tail behavior for a fixed-height scroll container. Auto-scrolls to bottom on contentKey change *only when the user is already at the bottom*; never yanks the viewport otherwise."
        preview={<UseAutoScrollDemo />}
        props={[
          { name: "ref", type: "RefObject<HTMLElement>" },
          { name: "contentKey", type: "any", description: "Whatever signals 'content changed' — usually events.length." },
          { name: "thresholdPx", type: "number", default: "24", description: '"At bottom" tolerance.' },
        ]}
        code={`const ref = useRef<HTMLElement>(null);
const { atBottom, scrollToBottom } = useAutoScroll(ref, events.length);

return (
  <>
    <main ref={ref} className="thread">{/* events */}</main>
    <ScrollToBottom visible={!atBottom} onClick={scrollToBottom} />
  </>
);`}
      />

      <ComponentCard
        id="comp-ScrollToBottom"
        name="<ScrollToBottom>"
        kind="util"
        description='Floating "↓ Latest" pill. Render with `visible={!atBottom}` and wire `onClick` to the scrollToBottom from useAutoScroll.'
        preview={
          <div style={{ position: "relative", padding: 18, border: "1px dashed var(--border-1)", borderRadius: 6, minHeight: 80 }}>
            <ScrollToBottom visible onClick={() => alert("scrolled!")} />
            <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>(parent must be position: relative)</span>
          </div>
        }
        props={[
          { name: "visible", type: "boolean" },
          { name: "onClick", type: "() => void" },
          { name: "children", type: "ReactNode", description: "Override the default '↓ Latest' label." },
        ]}
      />

      <ComponentCard
        id="comp-ScrollAnchor"
        name="<ScrollAnchor>"
        kind="util"
        description="Invisible end-of-thread marker. Place at the bottom of a custom thread layout so you can call `ref.current.scrollIntoView()` imperatively."
        code={`const anchorRef = useRef<HTMLDivElement>(null);

return (
  <main>
    {events.map(...)}
    <ScrollAnchor ref={anchorRef} />
  </main>
);

// Later:
anchorRef.current?.scrollIntoView({ behavior: "smooth" });`}
      />

      <ComponentCard
        id="comp-ConversationSearch"
        name="<ConversationSearch>"
        kind="util"
        description="Toolbar + provider. Walks events on every term change to compute matches; ↑↓ cycle through and scroll the current match into view. ConversationView's `showSearch` flag wraps the shell in this automatically."
        preview={
          <ConversationSearch events={SHORT_CONVERSATION}>
            <div style={{ marginTop: 12 }}>
              <ConversationView events={SHORT_CONVERSATION} />
            </div>
          </ConversationSearch>
        }
        props={[
          { name: "events", type: "ConversationEvent[]" },
          { name: "scrollContainerRef", type: "RefObject<HTMLElement>", description: "Element to scroll the current match into view." },
          { name: "children", type: "ReactNode", description: "The conversation tree to wrap with the SearchContext." },
        ]}
        code={`<ConversationSearch events={events}>
  <ConversationView events={events} mode="devtool" />
</ConversationSearch>`}
      />

      <ComponentCard
        id="comp-ToolPermissionProvider"
        name="<ToolPermissionProvider>"
        kind="util"
        description="Provides onAllow / onDeny handlers via context. ToolDisplay reads them and renders Allow / Deny actions when a tool call carries `permission: 'pending'`."
        preview={
          <ToolPermissionProvider
            onAllow={(id) => alert("allow " + id)}
            onDeny={(id) => alert("deny " + id)}
          >
            <ToolCallRequestDisplay
              event={{ ...CALL_BASH, permission: "pending" }}
              defaultExpanded
            />
          </ToolPermissionProvider>
        }
        props={[
          { name: "onAllow", type: "(toolCallId: string) => void" },
          { name: "onDeny", type: "(toolCallId: string) => void" },
        ]}
        code={`<ToolPermissionProvider
  onAllow={(id) => approve(id)}
  onDeny={(id) => reject(id)}
>
  <ConversationView events={events} />
</ToolPermissionProvider>

// or pass directly to ConversationView:
<ConversationView
  events={events}
  onAllowToolCall={approve}
  onDenyToolCall={reject}
/>`}
      />
    </TierGroup>
  );
}

/* helper for variant previews — synthesize the merged ToolEventLike a wrapper
 * would normally produce. Generic so each variant's narrowed input/output
 * types are inferred from the call site. */
function mergeForResult<I = unknown, O = unknown>(
  call: ToolCallEvent,
  result: ToolResultEvent
): ToolEventLike<I, O> {
  return {
    name: call.toolName,
    toolCallId: call.toolCallId,
    status: result.isError ? "error" : "complete",
    durationMs: result.durationMs,
    input: call.input as I,
    output: result.output as O,
    isError: result.isError,
    errorMessage: result.errorMessage,
  };
}

/* Inline demo for useAutoScroll: a small fixed-height feed the user can
 * append to and watch the live-tail behavior. Uses the actual hook. */
function UseAutoScrollDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(20);
  const { atBottom, scrollToBottom } = useAutoScroll(ref, count);
  return (
    <div style={{ position: "relative" }}>
      <div className="docs-controls" style={{ borderBottom: 0, padding: 0, marginBottom: 8 }}>
        <button className="btn" onClick={() => setCount((c) => c + 3)}>
          Append 3 lines
        </button>
        <span
          style={{
            color: "var(--fg-3)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          atBottom: {String(atBottom)}
        </span>
      </div>
      <div
        ref={ref}
        style={{
          height: 160,
          overflowY: "auto",
          border: "1px solid var(--border-1)",
          borderRadius: 6,
          padding: 12,
          background: "var(--bg-1)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--fg-2)",
          position: "relative",
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{ padding: "4px 0", borderBottom: "1px dashed var(--border-1)" }}
          >
            line #{i + 1}
          </div>
        ))}
        <ScrollToBottom visible={!atBottom} onClick={scrollToBottom} />
      </div>
    </div>
  );
}
