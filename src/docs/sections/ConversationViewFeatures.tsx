import { useMemo, useState } from "react";
import {
  ConversationView,
  type ConversationMode,
} from "../../components";
import { openAIToEvents, type OpenAIMessage } from "../../adapters";
import type {
  AssistantMessageEvent,
  ConversationEvent,
  UserMessageEvent,
} from "../../types/events";
import conversation from "../../demo/conversation.json";
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

const t0 = Date.parse("2026-05-04T12:00:00Z");

function buildBaseEvents(): ConversationEvent[] {
  return openAIToEvents(conversation as OpenAIMessage[], {
    startTime: t0,
    stepMs: 800,
  });
}

const FEATURE_CODE = `<ConversationView
  events={events}
  mode="devtool"             // 'chat' | 'devtool' | 'inspector'
  showSearch                 // ⌕ toolbar at top
  toolVariants={{ /* ... */ }}            // custom tool renderers
  components={{ /* ... */ }}              // custom UserMessage / AssistantMessage / ...
  onAllowToolCall={(id) => approve(id)}   // permission UX (renders Allow / Deny)
  onDenyToolCall={(id) => reject(id)}
  metadata={{ title, model }}
/>
`;

export function ConversationViewSection() {
  const [mode, setMode] = useState<ConversationMode>("chat");
  const [showSearch, setShowSearch] = useState(true);
  const [permissionEnabled, setPermissionEnabled] = useState(true);
  const [toolResultDefault, setToolResultDefault] = useState<"auto" | "collapsed" | "expanded">("auto");
  const [toolRequestDefault, setToolRequestDefault] = useState<"auto" | "collapsed" | "expanded">("auto");

  // Auto-scroll demo: append a synthetic user/assistant turn.
  const [appended, setAppended] = useState<ConversationEvent[]>([]);
  const [permissionOverrides, setPermissionOverrides] = useState<
    Record<string, "allowed" | "denied">
  >({});

  const baseEvents = useMemo(() => buildBaseEvents(), []);

  const events = useMemo(() => {
    const all = [...baseEvents, ...appended];
    return all.map((e) => {
      if (e.type !== "tool_call") return e;
      const override = permissionOverrides[e.toolCallId];
      if (override) return { ...e, permission: override };
      // Mark the bash call as pending so the Allow / Deny UX is visible.
      if (e.toolName === "bash") return { ...e, permission: "pending" as const };
      return e;
    });
  }, [baseEvents, appended, permissionOverrides]);

  const appendTurn = () => {
    const now = Date.now();
    const u: UserMessageEvent = {
      id: `live-u-${now}`,
      type: "user_message",
      status: "complete",
      timestamp: now,
      content:
        "Live append #" + (appended.length / 2 + 1) + " — useAutoScroll keeps me at the bottom while I'm at the bottom.",
    };
    const a: AssistantMessageEvent = {
      id: `live-a-${now}`,
      type: "assistant_message",
      status: "complete",
      timestamp: now + 100,
      content:
        "(echo from docs) — scroll up before clicking next time and you'll see the **↓ Latest** pill instead of an unwanted yank.",
    };
    setAppended((prev) => [...prev, u, a]);
  };

  const reset = () => {
    setAppended([]);
    setPermissionOverrides({});
  };

  return (
    <Section
      id="conversation-view"
      eyebrow="Reference"
      title="ConversationView features"
    >
      <Prose>
        <p>
          A single live conversation, controlled from the panel below. Toggle
          mode, search, and permission handlers to see how each feature shows
          up. The <strong>append turn</strong> button lets you exercise the
          live-tail behavior: stay at the bottom and you auto-scroll; scroll
          up first and a "↓ Latest" pill appears instead.
        </p>
      </Prose>

      <Example
        title="Live ConversationView with feature toggles"
        description="One view, all features wired in. The conversation is the OpenAI fixture under src/demo/conversation.json, run through openAIToEvents."
        preview={
          <>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>mode</span>
              <div className="seg" role="tablist">
                {(["chat", "devtool", "inspector"] as const).map((m) => (
                  <button
                    key={m}
                    className={mode === m ? "active" : ""}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={showSearch}
                  onChange={(e) => setShowSearch(e.target.checked)}
                />
                showSearch
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={permissionEnabled}
                  onChange={(e) => setPermissionEnabled(e.target.checked)}
                />
                permission handlers
              </label>
              <button className="btn" onClick={appendTurn}>
                Append turn
              </button>
              <button className="btn" onClick={reset}>
                Reset
              </button>
              <span
                style={{
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  marginLeft: "auto",
                }}
              >
                {events.length} events
              </span>
            </div>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>tool result default</span>
              <div className="seg" role="tablist">
                {(["auto", "collapsed", "expanded"] as const).map((v) => (
                  <button
                    key={v}
                    className={toolResultDefault === v ? "active" : ""}
                    onClick={() => setToolResultDefault(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span style={{ color: "var(--fg-3)" }}>tool request default</span>
              <div className="seg" role="tablist">
                {(["auto", "collapsed", "expanded"] as const).map((v) => (
                  <button
                    key={v}
                    className={toolRequestDefault === v ? "active" : ""}
                    onClick={() => setToolRequestDefault(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: 0 }}>
              <ConversationView
                events={events}
                mode={mode}
                showSearch={showSearch}
                toolRequestDefaultExpanded={
                  toolRequestDefault === "auto"
                    ? undefined
                    : toolRequestDefault === "expanded"
                }
                toolResultDefaultExpanded={
                  toolResultDefault === "auto"
                    ? undefined
                    : toolResultDefault === "expanded"
                }
                onAllowToolCall={
                  permissionEnabled
                    ? (id) =>
                        setPermissionOverrides((p) => ({ ...p, [id]: "allowed" }))
                    : undefined
                }
                onDenyToolCall={
                  permissionEnabled
                    ? (id) =>
                        setPermissionOverrides((p) => ({ ...p, [id]: "denied" }))
                    : undefined
                }
                metadata={{
                  title: "refactor src/api/client.ts",
                  model: "claude-opus-4-7",
                }}
              />
            </div>
          </>
        }
        code={<CodeBlock code={FEATURE_CODE} filename="App.tsx" />}
      />

      <Prose>
        <p>
          <strong>What to try:</strong>
        </p>
        <ul style={{ margin: "0 0 12px", paddingLeft: 20, lineHeight: "1.7" }}>
          <li>
            Search for "<code>client.fetch</code>" — the toolbar reports{" "}
            <code>3 / 3</code> matches and ↑↓ jump between them. Matching
            assistant turns and tool results both light up because the matcher
            walks tool inputs / outputs too.
          </li>
          <li>
            Switch to <strong>devtool</strong> and search for "<code>retries</code>"
            — the long collapsed assistant text stays collapsed but its
            wrapper still highlights, and ↓ scrolls it into view.
          </li>
          <li>
            With permission handlers enabled, the <strong>bash</strong> call's
            header carries a <em>needs approval</em> badge. Click <strong>
            Allow</strong> or <strong>Deny</strong> — the badge state
            updates, and your handlers fire with the matching{" "}
            <code>toolCallId</code>.
          </li>
          <li>
            Click <strong>Append turn</strong> while at the bottom — the view
            scrolls down to the new content. Scroll up first, then click — the
            view stays put and a <strong>↓ Latest</strong> pill appears in the
            corner. The viewport never yanks during a delta.
          </li>
          <li>
            Switch to <strong>inspector</strong> — same events, three-pane
            debug shell. Click any row to see the raw payload as a JSON tree
            (collapse-by-default, copy-by-path).
          </li>
        </ul>
      </Prose>
    </Section>
  );
}
