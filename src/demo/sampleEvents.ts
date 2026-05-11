import type {
  AssistantMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from "../types/events";

const t0 = Date.parse("2026-05-04T12:00:00Z");

export const sampleUser1: UserMessageEvent = {
  id: "u1",
  type: "user_message",
  status: "complete",
  timestamp: t0,
  content:
    "Refactor the data layer in `src/api/client.ts` to handle retries and surface API errors as a typed exception. Keep the public exports stable.",
  attachments: [
    { id: "a1", name: "spec.pdf", mimeType: "application/pdf", sizeBytes: 84_000 },
    {
      id: "a2",
      name: "mock.png",
      mimeType: "image/png",
      url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAAXNSR0IArs4c6QAAACpJREFUOE9jZGBg+M+ABjAAFGzCFGbAYBoFRgFGgVGAVDAaCkYDgVEAANUKBgWmrM4MAAAAAElFTkSuQmCC",
      sizeBytes: 4_400,
    },
  ],
};

export const sampleUserLong: UserMessageEvent = {
  id: "u2",
  type: "user_message",
  status: "complete",
  timestamp: t0 + 100,
  content: [
    "Here's the current transform — please port it to TypeScript with strict types:",
    "",
    "```javascript",
    "function transform(input) {",
    "  return input.map(x => ({",
    "    id: x.id,",
    "    score: x.score * 100,",
    "    label: x.label?.toLowerCase() ?? null,",
    "    children: x.children?.map(transform) ?? [],",
    "  }));",
    "}",
    "```",
    "",
    "Should preserve existing behavior for `null`/`undefined`. Add unit tests if you can.",
  ].join("\n"),
};

/* ------- assistant message + tool calls (success path) ------- */

export const sampleAssistant1: AssistantMessageEvent = {
  id: "a1",
  type: "assistant_message",
  status: "complete",
  timestamp: t0 + 1_000,
  content:
    "I'll start by reading the current `client.ts` to map call sites, then introduce a typed `ApiError` and a small retry wrapper.\n\nThree call sites use `client.fetch()`. Wrapping the underlying call keeps them unchanged.",
  finishReason: "tool_calls",
  usage: { inputTokens: 1280, outputTokens: 184 },
};

export const callRead: ToolCallEvent = {
  id: "tc1",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 1_100,
  toolCallId: "call_read_1",
  toolName: "read_file",
  input: { path: "src/api/client.ts" },
};

export const resultRead: ToolResultEvent = {
  id: "tr1",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 1_242,
  toolCallId: "call_read_1",
  durationMs: 142,
  output: `export class ApiClient {
  constructor(private baseUrl: string) {}

  async ping() {
    return "ok";
  }

  async fetch(path: string) {
    const r = await fetch(this.baseUrl + path);
    return r.json();
  }
}
`,
};

export const callReplace: ToolCallEvent = {
  id: "tc2",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 1_300,
  toolCallId: "call_replace_1",
  toolName: "str_replace",
  input: {
    path: "src/api/client.ts",
    old_str: `  async fetch(path: string) {
    const r = await fetch(this.baseUrl + path);
    return r.json();
  }`,
    new_str: `  async fetch(path: string) {
    const r = await this.retry(() => fetch(this.baseUrl + path));
    if (!r.ok) throw new ApiError(r.status, path);
    return r.json() as Promise<unknown>;
  }`,
  },
};

export const resultReplace: ToolResultEvent = {
  id: "tr2",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 1_540,
  toolCallId: "call_replace_1",
  durationMs: 240,
  output: { replacements: 1 },
};

export const callBash: ToolCallEvent = {
  id: "tc3",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 1_600,
  toolCallId: "call_bash_1",
  toolName: "bash",
  input: { command: "npm test --workspace @agentflow/core" },
};

export const resultBashFail: ToolResultEvent = {
  id: "tr3",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 5_800,
  toolCallId: "call_bash_1",
  durationMs: 4_200,
  output: {
    stdout: `PASS  src/parser.test.ts
PASS  src/store.test.ts
FAIL  src/api/client.test.ts
  ● ApiClient › retries on 5xx
`,
    stderr: `  Expected ApiError, received TypeError
    at Object.<anonymous> (src/api/client.test.ts:42:18)`,
    exitCode: 1,
  },
};

export const callGrep: ToolCallEvent = {
  id: "tc4",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_000,
  toolCallId: "call_grep_1",
  toolName: "grep",
  input: { pattern: "useEffect", path: "src/" },
};

export const resultGrep: ToolResultEvent = {
  id: "tr4",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 2_084,
  toolCallId: "call_grep_1",
  durationMs: 84,
  output: {
    totalMatches: 12,
    totalFiles: 4,
    truncated: 2,
    matches: [
      {
        file: "src/App.tsx",
        lines: [
          { lineNo: 14, text: "  useEffect(() => { load(); }, []);" },
          { lineNo: 28, text: "  useEffect(() => { if (id) refresh(id); }, [id]);" },
        ],
      },
      {
        file: "src/hooks/useResource.ts",
        lines: [
          { lineNo: 7, text: "  useEffect(() => {" },
          { lineNo: 8, text: "    let cancelled = false;" },
        ],
      },
    ],
  },
};

export const callGlob: ToolCallEvent = {
  id: "tc5",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_200,
  toolCallId: "call_glob_1",
  toolName: "glob",
  input: { pattern: "**/*.tsx" },
};

export const resultGlob: ToolResultEvent = {
  id: "tr5",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 2_242,
  toolCallId: "call_glob_1",
  durationMs: 42,
  output: {
    truncated: 18,
    files: [
      { path: "src/App.tsx", sizeBytes: 2_100 },
      { path: "src/components/Button.tsx", sizeBytes: 840 },
      { path: "src/components/Input.tsx", sizeBytes: 1_400 },
      { path: "src/components/Modal.tsx", sizeBytes: 3_200 },
      { path: "src/components/Toolbar.tsx", sizeBytes: 1_800 },
      { path: "src/hooks/useResource.tsx", sizeBytes: 920 },
    ],
  },
};

export const callSearch: ToolCallEvent = {
  id: "tc6",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 2_400,
  toolCallId: "call_search_1",
  toolName: "web_search",
  input: { query: "react server components production" },
};

export const resultSearch: ToolResultEvent = {
  id: "tr6",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 3_600,
  toolCallId: "call_search_1",
  durationMs: 1_200,
  output: {
    results: [
      {
        title: "Server Components — react.dev",
        url: "https://react.dev/learn/start-a-new-react-project",
        snippet:
          "React Server Components allow you to render parts of your UI on the server, reducing client-side bundle size while keeping interactivity where you need it.",
      },
      {
        title: "Understanding RSC in production — Vercel blog",
        url: "https://vercel.com/blog/understanding-react-server-components",
        snippet:
          "Real-world tradeoffs and patterns for using RSC in production: streaming, suspense, and incremental adoption.",
      },
      {
        title: "Server vs Client components — Next.js docs",
        url: "https://nextjs.org/docs/app/building-your-application/rendering",
        snippet:
          "When to use Server Components and when to opt into Client Components. Includes a decision tree and common patterns.",
      },
    ],
  },
};

/* errored tool */
export const callBadRead: ToolCallEvent = {
  id: "tc7",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 4_000,
  toolCallId: "call_bad_read",
  toolName: "read_file",
  input: { path: "src/missing.ts" },
};

export const resultBadRead: ToolResultEvent = {
  id: "tr7",
  type: "tool_result",
  status: "error",
  timestamp: t0 + 4_008,
  toolCallId: "call_bad_read",
  durationMs: 8,
  isError: true,
  errorMessage: "ENOENT: no such file or directory, open 'src/missing.ts'",
  output: null,
};

/* streaming assistant */
export const sampleAssistantStreaming: AssistantMessageEvent = {
  id: "a2",
  type: "assistant_message",
  status: "streaming",
  timestamp: t0 + 5_000,
  content:
    "Looking at the failure — the test expects an `ApiError`, but we're throwing the raw `TypeError` from `fetch`. I'll wrap that in `ApiError`",
};
