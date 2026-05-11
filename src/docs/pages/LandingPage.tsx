import { useMemo } from "react";
import { ConversationView } from "../../components";
import { openAIToEvents, type OpenAIMessage } from "../../adapters";
import { CodeBlock } from "../components/CodeBlock";
import { Logo } from "../components/Logo";

const HERO_MESSAGES: OpenAIMessage[] = [
  { role: "user", content: "Refactor `client.ts` to retry on 5xx and surface a typed error." },
  {
    role: "assistant",
    content: "Reading the file first.",
    tool_calls: [
      {
        id: "h_call_read",
        type: "function",
        function: {
          name: "read_file",
          arguments: JSON.stringify({ path: "src/api/client.ts" }),
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "h_call_read",
    content: `export class ApiClient {
  async fetch(path: string) {
    const r = await fetch(this.baseUrl + path);
    return r.json();
  }
}
`,
  },
  {
    role: "assistant",
    content: "Got it — wrapping the inner fetch with `this.retry(...)` and rethrowing non-2xx as `ApiError`.",
  },
];

const QUICK_START = `import { ConversationView } from "agentflow";
import { openAIToEvents } from "agentflow/adapters";

export function App({ messages }) {
  const events = openAIToEvents(messages);
  return (
    <ConversationView
      events={events}
      mode="chat"
      showSearch
      onAllowToolCall={(id) => approve(id)}
    />
  );
}`;

const FEATURES = [
  {
    eyebrow: "Composable",
    title: "Two tiers, eight slots, one registry",
    body: "Primitive renderers (CodeDisplay, MarkdownDisplay, DiffViewer, ImageDisplay, JsonDisplay) compose into event-aware secondaries. Override any of them via the components prop — no fork required.",
  },
  {
    eyebrow: "Adapter-driven",
    title: "OpenAI, Anthropic, or your own",
    body: "Built-in adapters for OpenAI Chat Completions and Anthropic Messages. Custom format? A 30-line MessageAdapter<TMessage> turns it into the normalized event stream the UI consumes.",
  },
  {
    eyebrow: "Three modes",
    title: "Chat. Devtool. Inspector.",
    body: "Same events, three layouts. Chat for end-users, devtool for evaluators with collapsible bundles + system prompts, inspector for debugging with a 3-pane raw-JSON browser. One prop flip.",
  },
  {
    eyebrow: "Theme-able",
    title: "All CSS variables",
    body: "Every color, radius, spacing token is a CSS variable. Override at :root or any ancestor — light/dark are presets. No styled-components, no tw-merge, no fight with your design system.",
  },
  {
    eyebrow: "Tool-aware",
    title: "Variants per tool",
    body: "read_file, write_file, str_replace, bash, grep, glob, web_search ship out of the box. Drop in a single component to render your custom tool — Julia eval, vector search, anything.",
  },
  {
    eyebrow: "Built for evals",
    title: "Search, scroll, permission",
    body: "Live-tail auto-scroll, full-text search across content + tool inputs/outputs, permission gates with Allow/Deny actions, JSON tree with copy-by-path. Everything an evaluator needs to read a transcript at speed.",
  },
];

export function LandingPage() {
  const heroEvents = useMemo(
    () =>
      openAIToEvents(HERO_MESSAGES, {
        startTime: Date.parse("2026-05-04T12:00:00Z"),
        idPrefix: "hero",
      }),
    []
  );

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-hero-eyebrow">
            <Logo size={20} /> agentflow
          </div>
          <h1>
            Render agentic conversations
            <br />
            <span className="accent">without compromising on composability.</span>
          </h1>
          <p>
            React components for chat, devtool, and inspector views of agent
            transcripts. Bring any provider format. Override any component.
            Theme with CSS variables.
          </p>
          <div className="landing-hero-cta">
            <a className="landing-cta primary" href="#/docs">
              Read the docs →
            </a>
            <a
              className="landing-cta"
              href="https://github.com/"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </a>
          </div>
          <ul className="landing-hero-meta">
            <li>
              <code>npm i agentflow</code>
            </li>
            <li>· peer dep: react ≥18</li>
            <li>· zero-dep core</li>
          </ul>
        </div>
        <div className="landing-hero-preview">
          <div className="landing-hero-preview-stage">
            <ConversationView events={heroEvents} mode="chat" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <header className="landing-section-head">
          <div className="landing-section-eyebrow">What you get</div>
          <h2>Built for the long tail of agent UIs</h2>
        </header>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature">
              <div className="landing-feature-eyebrow">{f.eyebrow}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Quick start */}
      <section className="landing-quickstart">
        <header className="landing-section-head">
          <div className="landing-section-eyebrow">Quick start</div>
          <h2>Five lines from messages to a rendered conversation</h2>
        </header>
        <div className="landing-quickstart-grid">
          <div>
            <p>
              The <code>openAIToEvents</code> adapter normalizes any
              OpenAI-style message log into our event format. Hand the result
              to <code>&lt;ConversationView&gt;</code> and you're done — search,
              auto-scroll, permission UX, and three render modes are wired in.
            </p>
            <p>
              Have a custom format? Write a <code>MessageAdapter&lt;TMessage&gt;</code>
              {" "}— it's a function that returns <code>ConversationEvent[]</code>.
              See{" "}
              <a href="#/docs#adapters">Writing adapters</a>.
            </p>
            <div className="landing-quickstart-actions">
              <a className="landing-cta primary" href="#/components">
                Browse components
              </a>
              <a className="landing-cta" href="#/integration">
                Integration sample
              </a>
            </div>
          </div>
          <CodeBlock code={QUICK_START} filename="App.tsx" />
        </div>
      </section>

      {/* Concept callouts */}
      <section className="landing-concepts">
        <article className="landing-concept">
          <div className="landing-concept-num">01</div>
          <h3>Normalized event stream</h3>
          <p>
            One union type. Nine event variants. Everything else is an adapter
            target — you bring messages, the library renders them.
          </p>
        </article>
        <article className="landing-concept">
          <div className="landing-concept-num">02</div>
          <h3>Variants by tool name</h3>
          <p>
            A registry maps tool names to React components. Built-ins for the
            common cases; consumers override or extend without forking.
          </p>
        </article>
        <article className="landing-concept">
          <div className="landing-concept-num">03</div>
          <h3>Slots, not props soup</h3>
          <p>
            <code>&lt;ToolDisplay.Header&gt;</code> /{" "}
            <code>&lt;ToolDisplay.Summary&gt;</code> /{" "}
            <code>&lt;ToolDisplay.Body&gt;</code>. Compose your way out of any
            visual edge case the default doesn't cover.
          </p>
        </article>
      </section>

      {/* Footer CTA */}
      <section className="landing-footer-cta">
        <div className="landing-footer-cta-inner">
          <h2>Ready to render your agents?</h2>
          <p>
            Read the interactive docs, then drop the components into your
            existing React app.
          </p>
          <div className="landing-hero-cta">
            <a className="landing-cta primary" href="#/docs">
              Read the docs →
            </a>
            <a className="landing-cta" href="#/components">
              Component reference
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
