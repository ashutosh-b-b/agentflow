import { useMemo, useState } from "react";
import { ConversationView } from "../../components";
import { openAIToEvents, type OpenAIMessage } from "../../adapters";
import conversation from "../../demo/conversation.json";
import { CodeBlock } from "../components/CodeBlock";
import type { NavItem } from "../Sidebar";

/* Per-conversation OpenAI fixtures. Each renders a different short scenario
 * so clicking around the sidebar actually changes the rendered thread. */
const CONV_FIXTURES: Record<string, OpenAIMessage[]> = {
  "c-001": conversation as OpenAIMessage[],

  "c-002": [
    {
      role: "user",
      content:
        "Sentry incident #4831 — the worker pool is OOM-ing in prod. Repro and fix.",
    },
    {
      role: "assistant",
      content:
        "Pulling the latest stack trace and the heap snapshot to see what's holding memory.",
      tool_calls: [
        {
          id: "call_grep_1",
          type: "function",
          function: {
            name: "grep",
            arguments: JSON.stringify({ pattern: "WorkerPool", path: "src/" }),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_grep_1",
      content: JSON.stringify({
        totalMatches: 4,
        totalFiles: 2,
        matches: [
          {
            file: "src/runtime/workers.ts",
            lines: [
              { lineNo: 14, text: "export class WorkerPool {" },
              { lineNo: 41, text: "  enqueue(job: Job) { this.queue.push(job); }" },
            ],
          },
        ],
      }),
    },
    {
      role: "assistant",
      content:
        "Found it — `enqueue` is unbounded; long-running jobs accumulate references that the GC can't collect. Patching with a bounded ring buffer.",
      tool_calls: [
        {
          id: "call_replace_2",
          type: "function",
          function: {
            name: "str_replace",
            arguments: JSON.stringify({
              path: "src/runtime/workers.ts",
              old_str:
                "  enqueue(job: Job) { this.queue.push(job); }",
              new_str:
                "  enqueue(job: Job) {\n    if (this.queue.length >= this.cap) this.queue.shift();\n    this.queue.push(job);\n  }",
            }),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_replace_2",
      content: JSON.stringify({ replacements: 1 }),
    },
    {
      role: "assistant",
      content: "Fix applied. RSS holds steady at ~480MB on the soak run.",
    },
  ],

  "c-003": [
    {
      role: "user",
      content:
        "Migrate the trace exporter from Datadog to OpenTelemetry. Keep the metric names compatible.",
    },
    {
      role: "assistant",
      content:
        "Let me run the smoke suite first to confirm the current state, then swap the exporter and re-run.",
      tool_calls: [
        {
          id: "call_bash_3",
          type: "function",
          function: {
            name: "bash",
            arguments: JSON.stringify({ command: "npm run smoke" }),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_bash_3",
      content: JSON.stringify({
        stdout:
          "PASS  smoke/health.test.ts\nFAIL  smoke/trace.test.ts\n  ● expected 'span.kind' to equal 'CLIENT'\n",
        stderr:
          "  Expected 'CLIENT' but got 'client' — case-sensitivity changed between exporters",
        exitCode: 1,
      }),
    },
    {
      role: "assistant",
      content:
        "OTel exporter normalizes `span.kind` to lowercase; the existing assertion is case-sensitive. Two options: relax the assertion or wrap the exporter with a kind-uppercase shim.",
    },
  ],

  "c-004": [
    {
      role: "user",
      content: "Draft the admin onboarding doc — 5 sections, screenshots from /screens.",
    },
    {
      role: "assistant",
      content: [
        "Outline:",
        "",
        "1. **Account creation** — invite flow, MFA setup",
        "2. **First project** — create, name, scope tags",
        "3. **Member roles** — owner / admin / member, invite limits",
        "4. **Billing** — plan picker, usage caps, overages",
        "5. **Audit log** — export, retention, redaction",
        "",
        "Pulling screenshots now.",
      ].join("\n"),
      tool_calls: [
        {
          id: "call_glob_4",
          type: "function",
          function: {
            name: "glob",
            arguments: JSON.stringify({ pattern: "screens/admin-*.png" }),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: "call_glob_4",
      content: JSON.stringify({
        files: [
          { path: "screens/admin-create.png", sizeBytes: 142_000 },
          { path: "screens/admin-mfa.png", sizeBytes: 88_000 },
          { path: "screens/admin-billing.png", sizeBytes: 204_000 },
          { path: "screens/admin-audit.png", sizeBytes: 96_000 },
          { path: "screens/admin-roles.png", sizeBytes: 110_000 },
        ],
      }),
    },
    {
      role: "assistant",
      content:
        "All five screenshots present. Stitching them into the corresponding sections now and pushing the draft for review.",
    },
  ],

  "c-005": [
    {
      role: "user",
      content:
        "Fuzz the new query parser. 24h budget, focused on operator precedence and Unicode identifiers.",
    },
  ],
};

export const INTEGRATION_NAV: NavItem[] = [
  { id: "integration-overview", label: "Overview", group: "Sample" },
  { id: "integration-app", label: "Mock app", group: "Sample" },
  { id: "integration-recipe", label: "How it's wired", group: "Reference" },
];

interface ConvSummary {
  id: string;
  title: string;
  preview: string;
  agent: string;
  ago: string;
  status: "running" | "passed" | "failed" | "queued";
}

const SIDEBAR_CONVERSATIONS: ConvSummary[] = [
  {
    id: "c-001",
    title: "Refactor src/api/client.ts",
    preview: "Got it — three call sites, all just doing `await client.fetch(path)`…",
    agent: "claude-opus-4-7",
    ago: "now",
    status: "running",
  },
  {
    id: "c-002",
    title: "Investigate Sentry incident #4831",
    preview: "Stack trace points to OOM in the worker pool. Looking at heap…",
    agent: "claude-sonnet-4-6",
    ago: "12m",
    status: "passed",
  },
  {
    id: "c-003",
    title: "Migrate datadog → opentelemetry",
    preview: "Drafted the trace exporter config; re-running the smoke suite.",
    agent: "claude-opus-4-7",
    ago: "1h",
    status: "failed",
  },
  {
    id: "c-004",
    title: "Generate admin onboarding doc",
    preview: "Outlined the 5 sections; pulling the screenshots from /screens.",
    agent: "claude-sonnet-4-6",
    ago: "3h",
    status: "passed",
  },
  {
    id: "c-005",
    title: "Fuzz the new query parser",
    preview: "Queued — waiting for compute.",
    agent: "claude-haiku-4-5",
    ago: "5h",
    status: "queued",
  },
];

const RECIPE = `// Your app shell handles the chrome — header, conversation list,
// auth, etc. ConversationView is just the main pane.

import { ConversationView } from "agentflow";

function AppShell() {
  return (
    <div className="app">
      <TopBar />
      <ConversationsList onSelect={setActiveId} />
      <main>
        <ConversationView
          events={events}
          mode="chat"
          showSearch
          metadata={{ title, model }}
          onAllowToolCall={(id) => approve(id)}
          onDenyToolCall={(id) => reject(id)}
        />
      </main>
      <RightInspector activeEventId={selectedEventId} />
    </div>
  );
}
`;

const STATUS_LABEL: Record<ConvSummary["status"], string> = {
  running: "running",
  passed: "passed",
  failed: "failed",
  queued: "queued",
};

const STATUS_CLASS: Record<ConvSummary["status"], string> = {
  running: "status-running",
  passed: "status-passed",
  failed: "status-failed",
  queued: "status-queued",
};

export function IntegrationPage() {
  const [activeId, setActiveId] = useState(SIDEBAR_CONVERSATIONS[0].id);
  const active = SIDEBAR_CONVERSATIONS.find((c) => c.id === activeId)!;

  const events = useMemo(() => {
    const messages = CONV_FIXTURES[activeId] ?? [];
    return openAIToEvents(messages, {
      startTime: Date.parse("2026-05-04T12:00:00Z"),
      stepMs: 800,
      idPrefix: activeId, // unique IDs per conversation so search/scroll keys don't collide
    });
  }, [activeId]);

  return (
    <>
      {/* Overview */}
      <section id="integration-overview" className="docs-section">
        <header className="docs-section-head">
          <div className="docs-section-eyebrow">Sample</div>
          <h2 className="docs-section-title">Integration sample</h2>
        </header>
        <div className="docs-prose">
          <p>
            <code>&lt;ConversationView&gt;</code> is the main pane. The
            chrome around it — header, conversation list, account menu — is
            yours. Below is a mock <strong>SaaS-style agent console</strong>
            {" "}showing what a real integration looks like.
          </p>
          <p>
            Click any conversation in the left list to switch the active
            thread — each one is a different short scenario. Everything
            inside the main pane is the real component, including search,
            permission UX, and live-tail scroll.
          </p>
        </div>
      </section>

      {/* The mock app */}
      <section id="integration-app" className="docs-section">
        <div className="mock-app">
          {/* top bar */}
          <header className="mock-topbar">
            <div className="mock-brand">
              <span className="mock-brand-mark">▲</span>
              <span className="mock-brand-name">Reactor</span>
              <span className="mock-brand-sep">/</span>
              <span className="mock-brand-team">platform-eng</span>
            </div>
            <div className="mock-topbar-search">
              <span aria-hidden>⌕</span>
              <input
                type="search"
                placeholder="Search runs, agents, artifacts…"
                aria-label="Global search"
              />
            </div>
            <div className="mock-topbar-actions">
              <button className="mock-icon-btn" aria-label="Notifications">🔔</button>
              <button className="mock-icon-btn" aria-label="Help">?</button>
              <span className="mock-avatar">AB</span>
            </div>
          </header>

          {/* body grid */}
          <div className="mock-body">
            {/* left: conversations */}
            <aside className="mock-sidebar">
              <div className="mock-sidebar-head">
                <div className="mock-sidebar-title">Conversations</div>
                <button className="btn">+ New</button>
              </div>
              <div className="mock-conv-list">
                {SIDEBAR_CONVERSATIONS.map((c) => (
                  <button
                    key={c.id}
                    className={[
                      "mock-conv",
                      activeId === c.id ? "active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setActiveId(c.id)}
                  >
                    <div className="mock-conv-row1">
                      <span className="mock-conv-title">{c.title}</span>
                      <span className="mock-conv-ago">{c.ago}</span>
                    </div>
                    <div className="mock-conv-preview">{c.preview}</div>
                    <div className="mock-conv-row3">
                      <span className={`mock-status ${STATUS_CLASS[c.status]}`}>
                        ● {STATUS_LABEL[c.status]}
                      </span>
                      <span className="mock-conv-agent">{c.agent}</span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* main: ConversationView */}
            <main className="mock-main">
              <div className="mock-main-head">
                <div>
                  <h3 className="mock-main-title">{active.title}</h3>
                  <div className="mock-main-meta">
                    <span className={`mock-status ${STATUS_CLASS[active.status]}`}>
                      ● {STATUS_LABEL[active.status]}
                    </span>
                    <span>·</span>
                    <span>{active.agent}</span>
                    <span>·</span>
                    <span>started 14 min ago</span>
                  </div>
                </div>
                <div className="mock-main-actions">
                  <button className="btn">Pause</button>
                  <button className="btn">Share</button>
                  <button className="btn primary">Approve all</button>
                </div>
              </div>
              <div className="mock-main-conv">
                <ConversationView
                  events={events}
                  mode="chat"
                  showSearch
                  metadata={{ title: active.title, model: active.agent }}
                  onAllowToolCall={() => {}}
                  onDenyToolCall={() => {}}
                />
              </div>
            </main>
          </div>
        </div>
      </section>

      {/* Recipe */}
      <section id="integration-recipe" className="docs-section">
        <header className="docs-section-head">
          <div className="docs-section-eyebrow">Reference</div>
          <h2 className="docs-section-title">How it's wired</h2>
        </header>
        <div className="docs-prose">
          <p>
            All the chrome above (top bar, conversation list, status pills,
            action buttons) is mock HTML — not part of the library. The
            library only owns the main conversation pane:
          </p>
        </div>
        <CodeBlock code={RECIPE} filename="AppShell.tsx" />
        <div className="docs-prose" style={{ marginTop: 16 }}>
          <p>
            <strong>Pattern:</strong> treat <code>&lt;ConversationView&gt;</code>{" "}
            as a leaf in your app's layout tree. Wire its hook handlers
            (<code>onAllowToolCall</code> / <code>onDenyToolCall</code>) into
            the same store that drives your sidebar's status pills, and the
            two stay in lockstep.
          </p>
          <p>
            Theming inherits from the page — the mock's tokens, the library's
            tokens, and the rest of your app's CSS variables are all the same
            namespace. No special host wrapper required.
          </p>
        </div>
      </section>
    </>
  );
}
