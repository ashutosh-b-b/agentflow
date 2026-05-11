import { useMemo, useState } from "react";
import {
  ConversationView,
  type ConversationMode,
} from "../../components";
import {
  anthropicToEvents,
  openAIToEvents,
  type AnthropicMessage,
  type OpenAIMessage,
} from "../../adapters";
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

const SAMPLE_OPENAI: OpenAIMessage[] = [
  { role: "user", content: "What's 2 + 2?" },
  {
    role: "assistant",
    content: "Let me check that with a quick eval.",
    tool_calls: [
      {
        id: "call_calc_1",
        type: "function",
        function: {
          name: "calculator",
          arguments: '{"expression":"2 + 2"}',
        },
      },
    ],
  },
  { role: "tool", tool_call_id: "call_calc_1", content: '{"result":4}' },
  { role: "assistant", content: "It's **4**." },
];

const SAMPLE_ANTHROPIC: AnthropicMessage[] = [
  { role: "user", content: "What's 2 + 2?" },
  {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "I should run a quick calculator call." },
      { type: "text", text: "Let me check that with a quick eval." },
      {
        type: "tool_use",
        id: "calc_1",
        name: "calculator",
        input: { expression: "2 + 2" },
      },
    ],
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "calc_1", content: '{"result":4}' },
    ],
  },
  { role: "assistant", content: "It's **4**." },
];

const CUSTOM_ADAPTER = `import {
  type MessageAdapter,
  createAdapterContext,
} from "agentflow-ui/adapters";

interface MyMessage {
  speaker: "human" | "agent";
  body: string;
}

export function myFormatToEvents(messages: MyMessage[]) {
  const ctx = createAdapterContext();
  return messages.map((m) => ({
    id: ctx.newId(),
    type: m.speaker === "human" ? "user_message" as const
                                : "assistant_message" as const,
    status: "complete" as const,
    timestamp: ctx.tick(),
    content: m.body,
    raw: m,
  }));
}

export function createMyAdapter(): MessageAdapter<MyMessage> {
  return { toEvents: myFormatToEvents };
}
`;

const TRY_OPENAI_DEFAULT = JSON.stringify(SAMPLE_OPENAI, null, 2);

export function AdaptersSection() {
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [mode, setMode] = useState<ConversationMode>("chat");
  const [draft, setDraft] = useState(TRY_OPENAI_DEFAULT);
  const [error, setError] = useState<string | null>(null);

  const events = useMemo(() => {
    setError(null);
    try {
      const parsed = JSON.parse(draft);
      if (provider === "openai") {
        return openAIToEvents(parsed as OpenAIMessage[], {
          startTime: Date.parse("2026-05-04T12:00:00Z"),
        });
      }
      return anthropicToEvents(parsed as AnthropicMessage[], {
        startTime: Date.parse("2026-05-04T12:00:00Z"),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return [];
    }
  }, [draft, provider]);

  return (
    <Section id="adapters" eyebrow="Extending" title="Writing adapters">
      <Prose>
        <p>
          An <strong>adapter</strong> turns provider-specific messages into the
          normalized event stream. The library ships adapters for OpenAI Chat
          Completions and Anthropic Messages; anyone with a custom format
          writes a function returning <code>ConversationEvent[]</code> and
          passes the result to <code>&lt;ConversationView&gt;</code>.
        </p>
        <p>
          The full reference lives in{" "}
          <code>docs/custom-adapters.md</code>; below is a live tour.
        </p>
      </Prose>

      <Example
        title="Try it: paste OpenAI / Anthropic JSON, see the rendered events"
        description="The adapter is pure — no network, no keys. Edit the JSON and the preview updates on every keystroke."
        preview={
          <>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>provider</span>
              <div className="seg" role="tablist">
                <button
                  className={provider === "openai" ? "active" : ""}
                  onClick={() => {
                    setProvider("openai");
                    setDraft(JSON.stringify(SAMPLE_OPENAI, null, 2));
                  }}
                >
                  OpenAI
                </button>
                <button
                  className={provider === "anthropic" ? "active" : ""}
                  onClick={() => {
                    setProvider("anthropic");
                    setDraft(JSON.stringify(SAMPLE_ANTHROPIC, null, 2));
                  }}
                >
                  Anthropic
                </button>
              </div>
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
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: 18,
              }}
            >
              <div>
                <div className="vlabel" style={{ marginBottom: 6 }}>
                  source · {provider}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    minHeight: 360,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    background: "var(--code-bg)",
                    color: "var(--code-fg)",
                    border: "1px solid var(--border-1)",
                    borderRadius: 6,
                    padding: 10,
                  }}
                />
                {error && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--danger-soft-fg)",
                      background: "var(--danger-soft)",
                      border: "1px solid var(--danger)",
                      padding: "6px 8px",
                      borderRadius: 4,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    JSON error: {error}
                  </div>
                )}
              </div>
              <div>
                <div className="vlabel" style={{ marginBottom: 6 }}>
                  → {events.length} events · rendered
                </div>
                <ConversationView events={events} mode={mode} />
              </div>
            </div>
          </>
        }
      />

      <Example
        title="Writing your own adapter"
        description="A function that returns ConversationEvent[]. Use createAdapterContext() for ID + timestamp synthesis."
        code={<CodeBlock code={CUSTOM_ADAPTER} filename="adapters/my-format.ts" language="ts" />}
      />
    </Section>
  );
}
