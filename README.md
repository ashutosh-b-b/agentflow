# agentflow

[![npm version](https://img.shields.io/npm/v/agentflow.svg)](https://www.npmjs.com/package/agentflow)
[![license](https://img.shields.io/npm/l/agentflow.svg)](./LICENSE)

Composable React components for rendering agentic conversations.

Same set of events → three layouts: a chat-bubble thread for end users, a
flat devtool view for evaluators, and a three-pane inspector for debugging.
Adapters for OpenAI and Anthropic ship out of the box; a 30-line
`MessageAdapter<TMessage>` covers anything else.

```bash
npm install agentflow-ui
```

```tsx
import { ConversationView } from "agentflow-ui";
import { openAIToEvents } from "agentflow-ui/adapters";
import "agentflow-ui/styles.css";

export function App({ messages }) {
  const events = openAIToEvents(messages);
  return <ConversationView events={events} mode="chat" showSearch />;
}
```

## What's in the box

- **Three modes**, one prop — `chat`, `devtool`, `inspector`.
- **Multi-provider adapters** — OpenAI Chat Completions, Anthropic
  Messages. Custom formats: write a function returning
  `ConversationEvent[]`.
- **Tool variants** — `read_file` / `write_file` / `str_replace`, `bash`,
  `grep`, `glob`, `web_search`, with chip strips for flags, exit-info
  insets for shell failures, and an extensible registry. Unknown tools
  fall through to a JSON-tree dump — never a crash.
- **Field-name tolerance** — accepts the common synonyms
  (`path | filepath | file_path | …`, `command | cmd | script | …`,
  `pattern | regex | search | …`); your adapter doesn't have to fight us.
- **Theming** — every visual property is a CSS variable. `:root[data-theme]`
  flips light / dark; override any token at any ancestor.
- **Live-tail scroll**, **full-text search** across tool inputs/outputs,
  **permission gates** with Allow / Deny actions.
- **Component overrides** — replace `UserMessage` / `AssistantMessage` /
  any of the secondaries via the `components` prop on `ConversationView`.
- **Custom languages** — `registerLanguage(grammar, "mylang", ".myl")`
  wires syntax highlighting at runtime.

## Adapters

```tsx
import { openAIToEvents, anthropicToEvents, inferIsError } from "agentflow-ui/adapters";

const events = openAIToEvents(messagesFromOpenAI);
// or:
const events = anthropicToEvents(messagesFromAnthropic, { system: "..." });
```

Writing one for your own format:

```ts
import { type MessageAdapter, createAdapterContext } from "agentflow-ui/adapters";

export function myFormatToEvents(messages: MyMessage[]) {
  const ctx = createAdapterContext();
  return messages.map((m) => ({
    id: ctx.newId(),
    type: m.speaker === "human" ? "user_message" : "assistant_message",
    status: "complete",
    timestamp: ctx.tick(),
    content: m.body,
    raw: m,
  }));
}
```

## Permission gates

```tsx
<ConversationView
  events={events}
  onAllowToolCall={(id) => approve(id)}
  onDenyToolCall={(id) => reject(id)}
/>
```

Tool calls carrying `permission: "pending"` auto-expand with Allow / Deny
buttons in the header. Wire the handlers to the same store that drives the
rest of your app.

## Custom tool displays

```tsx
import { ToolDisplay, type ToolVariantProps } from "agentflow-ui";

function VectorSearchDisplay({ event, mode = "merged", ...rest }: ToolVariantProps) {
  // ...render whatever you want from event.input / event.output...
}

<ConversationView toolVariants={{ vector_search: VectorSearchDisplay }} />
```

## Docs

- **Interactive docs**: [Landing page](https://ashutoshbb.me/agentflow/) ·
  [Component reference](https://ashutoshbb.me/agentflow/#/components) ·
  [Integration sample](https://ashutoshbb.me/agentflow/#/integration)
- **Reference markdown** (in this repo): [`docs/custom-adapters.md`](./docs/custom-adapters.md) ·
  [`docs/custom-tools.md`](./docs/custom-tools.md) ·
  [`docs/canonical-tool-shapes.md`](./docs/canonical-tool-shapes.md) ·
  [`docs/example-julia-tool.md`](./docs/example-julia-tool.md)

## License

MIT
