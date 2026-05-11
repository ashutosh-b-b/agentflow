/**
 * OpenAI Chat Completions message format → Agentflow event format.
 *
 * Implements the static side of plan §5 (`MessageAdapter<TMessage>`). The
 * streaming side (`Adapter<TChunk>`) lives in a separate module once we wire
 * up transports.
 */

import type {
  AssistantMessageEvent,
  Attachment,
  ConversationEvent,
  SystemMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from "../types/events";
import {
  type AdapterOptions,
  type MessageAdapter,
  createAdapterContext,
  durationFromContext,
  safeParseJson,
} from "./types";

/* ------------ OpenAI message types we accept ------------ */

export type OpenAIRole = "system" | "user" | "assistant" | "tool";

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded string. Empty / partial during streaming. */
    arguments: string;
  };
}

export type OpenAIUserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type OpenAIMessage =
  | { role: "system"; content: string; name?: string }
  | { role: "user"; content: string | OpenAIUserContentPart[]; name?: string }
  | {
      role: "assistant";
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
      refusal?: string | null;
      name?: string;
    }
  | { role: "tool"; tool_call_id: string; content: string; name?: string };

/* ------------ adapter options ------------ */

export interface OpenAIAdapterOptions extends AdapterOptions {
  /** Mark the final assistant message (if any) as `status: "streaming"`. Useful for demos. */
  streamLast?: boolean;
}

/* ------------ helpers ------------ */

type UserContent = string | OpenAIUserContentPart[];

function userContentToText(content: UserContent): {
  text: string;
  attachments?: Attachment[];
} {
  if (typeof content === "string") return { text: content };
  const text: string[] = [];
  const attachments: Attachment[] = [];
  let imgIdx = 0;
  for (const part of content) {
    if (part.type === "text") text.push(part.text);
    else if (part.type === "image_url") {
      attachments.push({
        id: `img-${imgIdx++}`,
        name: `image-${imgIdx}.png`,
        mimeType: "image/png",
        url: part.image_url.url,
      });
    }
  }
  return {
    text: text.join("\n"),
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/* ------------ adapter ------------ */

export function openAIToEvents(
  messages: OpenAIMessage[],
  opts: OpenAIAdapterOptions = {}
): ConversationEvent[] {
  const ctx = createAdapterContext(opts);
  const out: ConversationEvent[] = [];
  let lastAssistantIdx = -1;

  for (const msg of messages) {
    if (msg.role === "system") {
      const e: SystemMessageEvent = {
        id: ctx.newId(),
        type: "system_message",
        status: "complete",
        timestamp: ctx.tick(),
        content: msg.content,
        raw: msg,
      };
      out.push(e);
      continue;
    }

    if (msg.role === "user") {
      const { text, attachments } = userContentToText(msg.content);
      const e: UserMessageEvent = {
        id: ctx.newId(),
        type: "user_message",
        status: "complete",
        timestamp: ctx.tick(),
        content: text,
        attachments,
        raw: msg,
      };
      out.push(e);
      continue;
    }

    if (msg.role === "assistant") {
      const a: AssistantMessageEvent = {
        id: ctx.newId(),
        type: "assistant_message",
        status: "complete",
        timestamp: ctx.tick(),
        content: msg.content ?? "",
        finishReason:
          msg.tool_calls && msg.tool_calls.length > 0 ? "tool_calls" : "stop",
        raw: msg,
      };
      out.push(a);
      lastAssistantIdx = out.length - 1;

      for (const tc of msg.tool_calls ?? []) {
        const ts = ctx.tick((opts.stepMs ?? 100) / 2);
        ctx.callTimes.set(tc.id, ts);
        const e: ToolCallEvent = {
          id: ctx.newId(),
          type: "tool_call",
          status: "complete",
          timestamp: ts,
          toolCallId: tc.id,
          toolName: tc.function.name,
          input: safeParseJson(tc.function.arguments),
          inputRaw: tc.function.arguments,
          raw: tc,
        };
        out.push(e);
      }
      continue;
    }

    if (msg.role === "tool") {
      const ts = ctx.tick();
      const parsed = safeParseJson(msg.content);
      const e: ToolResultEvent = {
        id: ctx.newId(),
        type: "tool_result",
        status: "complete",
        timestamp: ts,
        toolCallId: msg.tool_call_id,
        durationMs: durationFromContext(ctx, msg.tool_call_id, ts),
        output: parsed,
        // `isError` cannot be inferred from raw OpenAI tool messages — they
        // carry no error flag. Variants surface non-zero exitCode etc. via the
        // output object.
        isError: false,
        raw: msg,
      };
      out.push(e);
      continue;
    }
  }

  if (opts.streamLast && lastAssistantIdx >= 0) {
    const last = out[lastAssistantIdx];
    if (last.type === "assistant_message" && last === out[out.length - 1]) {
      out[lastAssistantIdx] = { ...last, status: "streaming" };
    }
  }

  return out;
}

/** Factory: returns a `MessageAdapter<OpenAIMessage>` bound to the given options. */
export function createOpenAIMessageAdapter(
  opts: OpenAIAdapterOptions = {}
): MessageAdapter<OpenAIMessage> {
  return {
    toEvents: (messages) => openAIToEvents(messages, opts),
  };
}
