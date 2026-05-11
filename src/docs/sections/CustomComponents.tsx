import { useState } from "react";
import {
  ConversationView,
  type AssistantMessageProps,
} from "../../components";
import { MarkdownDisplay } from "../../primitives";
import type { ConversationEvent } from "../../types/events";
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

const t0 = Date.parse("2026-05-04T12:00:00Z");

const EVENTS: ConversationEvent[] = [
  {
    id: "u1",
    type: "user_message",
    status: "complete",
    timestamp: t0,
    content: "Summarize the design tokens approach in two sentences.",
  },
  {
    id: "a1",
    type: "assistant_message",
    status: "complete",
    timestamp: t0 + 1_200,
    content:
      "Every component reads its colors from CSS variables in `tokens.css`. Override the variables at `:root` (or any ancestor) and the whole tree re-themes — no recompile, no fork.",
    finishReason: "stop",
  },
];

/* ---- the override ---- */
function BrandedAssistantMessage({ event }: AssistantMessageProps) {
  return (
    <div
      style={{
        border: "1px solid var(--accent-1)",
        background: "var(--accent-1-soft)",
        borderRadius: 12,
        padding: "14px 16px",
        position: "relative",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent-1-soft-fg)",
          marginBottom: 6,
        }}
      >
        🦦 Otter — your friendly stand-in
      </div>
      <div style={{ color: "var(--fg-1)" }}>
        <MarkdownDisplay value={event.content} />
      </div>
    </div>
  );
}

const CODE = `import {
  ConversationView,
  type AssistantMessageProps,
  MarkdownDisplay,
} from "agentflow-ui";

function BrandedAssistantMessage({ event }: AssistantMessageProps) {
  return (
    <div className="my-asst-bubble">
      <div className="brand">🦦 Otter — your friendly stand-in</div>
      <MarkdownDisplay value={event.content} />
    </div>
  );
}

<ConversationView
  events={events}
  components={{ AssistantMessage: BrandedAssistantMessage }}
/>
`;

export function CustomComponentsSection() {
  const [overridden, setOverridden] = useState(true);
  const components = overridden
    ? { AssistantMessage: BrandedAssistantMessage }
    : undefined;

  return (
    <Section id="custom-components" eyebrow="Extending" title="Custom components">
      <Prose>
        <p>
          Every secondary component is replaceable through the{" "}
          <code>components</code> prop on{" "}
          <code>&lt;ConversationView&gt;</code>. Pass <code>UserMessage</code>,{" "}
          <code>AssistantMessage</code>, <code>ToolCallRequestDisplay</code>,{" "}
          <code>ToolCallResultDisplay</code>, <code>ThinkingDisplay</code>,{" "}
          <code>CompactionDisplay</code>, <code>ErrorDisplay</code>, or{" "}
          <code>SystemMessageDisplay</code>. Anything you omit falls back to
          the built-in.
        </p>
        <p>
          The override receives the same props as the default — typed via the
          component's own <code>*Props</code> interface — so you can be as
          minimal or maximal as you want.
        </p>
      </Prose>

      <Example
        title="Toggle: default vs branded AssistantMessage"
        description="Same events, same ConversationView. The override only swaps the assistant bubble — user message + tool calls (when present) keep using the built-ins."
        preview={
          <>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>AssistantMessage</span>
              <div className="seg" role="tablist">
                <button
                  className={!overridden ? "active" : ""}
                  onClick={() => setOverridden(false)}
                >
                  default
                </button>
                <button
                  className={overridden ? "active" : ""}
                  onClick={() => setOverridden(true)}
                >
                  custom (Otter)
                </button>
              </div>
            </div>
            <ConversationView events={EVENTS} components={components} />
          </>
        }
        code={<CodeBlock code={CODE} filename="BrandedAssistantMessage.tsx" />}
      />
    </Section>
  );
}
