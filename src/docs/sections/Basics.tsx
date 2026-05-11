import { useState } from "react";
import { ConversationView } from "../../components";
import type {
  AssistantMessageEvent,
  ConversationEvent,
  UserMessageEvent,
} from "../../types/events";
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

const t0 = Date.parse("2026-05-04T12:00:00Z");

const SEED_EVENTS: ConversationEvent[] = [
  {
    id: "u0",
    type: "user_message",
    status: "complete",
    timestamp: t0,
    content: "Why is the sky blue?",
  },
  {
    id: "a0",
    type: "assistant_message",
    status: "complete",
    timestamp: t0 + 1_200,
    content:
      "Short answer: **Rayleigh scattering**. Sunlight hits molecules in the atmosphere; shorter (blue) wavelengths scatter more strongly than longer ones, so the sky takes on the scattered color.",
  },
];

const QUICKSTART = `import { ConversationView } from "agentflow";

const events = [
  { id: "u0", type: "user_message", status: "complete",
    timestamp: Date.now(), content: "Why is the sky blue?" },
  { id: "a0", type: "assistant_message", status: "complete",
    timestamp: Date.now(), content: "Short answer: **Rayleigh scattering**." },
];

export function App() {
  return <ConversationView events={events} />;
}
`;

const EVENT_FORMAT = `// src/types/events.ts
type EventStatus = "pending" | "streaming" | "complete" | "error";
type EventType =
  | "user_message" | "assistant_message" | "thinking"
  | "tool_call"    | "tool_result"
  | "compaction"   | "system_message" | "error" | "citation";

interface BaseEvent {
  id: string;          // unique within the conversation
  type: EventType;
  status: EventStatus;
  timestamp: number;   // ms since epoch
  raw?: unknown;       // optional — original upstream payload (recommended)
}

// Each subtype adds the fields it needs:
interface AssistantMessageEvent extends BaseEvent {
  type: "assistant_message";
  content: string;
  finishReason?: "stop" | "tool_calls" | "length" | "error";
}
`;

export function BasicsSection() {
  const [events, setEvents] = useState<ConversationEvent[]>(SEED_EVENTS);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const now = Date.now();
    const u: UserMessageEvent = {
      id: `u-${now}`,
      type: "user_message",
      status: "complete",
      timestamp: now,
      content: text,
    };
    const a: AssistantMessageEvent = {
      id: `a-${now}`,
      type: "assistant_message",
      status: "complete",
      timestamp: now + 100,
      content:
        "(echo) " + text + "\n\nThis is a stub assistant — replace with your own runtime.",
    };
    setEvents((prev) => [...prev, u, a]);
    setDraft("");
  };

  const reset = () => {
    setEvents(SEED_EVENTS);
    setDraft("");
  };

  return (
    <Section id="basics" eyebrow="Getting started" title="Basics">
      <Prose>
        <p>
          <strong>agentflow</strong> renders agentic conversations from a
          normalized event stream. You hand <code>&lt;ConversationView&gt;</code>
          {" "}an array of events; it picks the right component for each event
          type and renders chat-bubble, devtool, or inspector layouts.
        </p>
        <p>
          The library is composable in two directions: any component can be
          replaced (per <a href="#custom-components">Custom components</a>), and
          any input format can be converted to events (per{" "}
          <a href="#adapters">Writing adapters</a>).
        </p>
      </Prose>

      <Example
        title="The 5-line hello world"
        description="Two seed events, default chat-bubble layout, dark theme inherited from the page."
        preview={
          <ConversationView
            events={events}
            metadata={{ title: "live preview", model: "demo" }}
          />
        }
        code={<CodeBlock code={QUICKSTART} filename="App.tsx" />}
      />

      <Example
        title="Live: append events"
        description="Edit the input below to push a user/assistant pair into the same view above. The view re-renders on each change."
        preview={
          <div className="docs-controls" style={{ flexWrap: "wrap" }}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Type a message and press Enter"
              style={{ flex: 1, minWidth: 240 }}
            />
            <button className="btn" onClick={send}>Send</button>
            <button className="btn" onClick={reset}>Reset</button>
            <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {events.length} events
            </span>
          </div>
        }
      />

      <Example
        title="The event format"
        description="Every component reads from this normalized shape. Adapters convert provider-specific formats into it."
        code={<CodeBlock code={EVENT_FORMAT} filename="events.ts" language="ts" />}
      />
    </Section>
  );
}
