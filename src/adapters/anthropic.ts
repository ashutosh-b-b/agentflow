/**
 * Anthropic Messages API format → Agentflow event format.
 *
 * Anthropic's wire format differs from OpenAI's in three ways that matter for
 * us:
 *
 *   1. Tool *calls* are inline content blocks of the assistant message
 *      (`{ type: "tool_use", id, name, input }`), not a sibling field.
 *   2. Tool *results* are inline content blocks of the *user* message
 *      (`{ type: "tool_result", tool_use_id, content, is_error }`) — there's
 *      no dedicated "tool" role.
 *   3. Extended thinking and redacted thinking are first-class content blocks
 *      on the assistant message.
 *
 * We flatten all of that into our linear ConversationEvent stream:
 *
 *   - assistant content blocks → 1 assistant_message + N tool_call + N thinking
 *   - user content blocks      → 1 user_message + N tool_result
 *   - the request's `system`   → optional leading system_message
 */

import type {
  AssistantMessageEvent,
  Attachment,
  ConversationEvent,
  SystemMessageEvent,
  ThinkingEvent,
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

/* ------------ Anthropic content-block types we accept ------------ */

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export interface AnthropicImageBlock {
  type: "image";
  source:
    | { type: "base64"; media_type: string; data: string }
    | { type: "url"; url: string };
}

export interface AnthropicDocumentBlock {
  type: "document";
  source:
    | { type: "base64"; media_type: string; data: string }
    | { type: "url"; url: string }
    | { type: "text"; media_type: "text/plain"; data: string };
  title?: string;
}

export interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  /** Either a plain string or a list of content blocks (typically text). */
  content: string | Array<AnthropicTextBlock | AnthropicImageBlock>;
  is_error?: boolean;
}

export interface AnthropicThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface AnthropicRedactedThinkingBlock {
  type: "redacted_thinking";
  data: string;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicDocumentBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock
  | AnthropicThinkingBlock
  | AnthropicRedactedThinkingBlock;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicAdapterOptions extends AdapterOptions {
  /**
   * The request's top-level system prompt. Anthropic doesn't put system
   * messages in the `messages` array — they're a sibling field. Pass it here
   * and the adapter will prepend a `system_message` event.
   */
  system?: string | AnthropicTextBlock[];
  /** Mark the final assistant message (if any) as `status: "streaming"`. */
  streamLast?: boolean;
}

/* ------------ helpers ------------ */

function blocksOf(content: AnthropicMessage["content"]): AnthropicContentBlock[] {
  return typeof content === "string" ? [{ type: "text", text: content }] : content;
}

function textOf(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((b): b is AnthropicTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function imageBlockToAttachment(
  block: AnthropicImageBlock,
  idx: number
): Attachment {
  const src = block.source;
  if (src.type === "base64") {
    return {
      id: `img-${idx}`,
      name: `image-${idx}.${(src.media_type.split("/")[1] ?? "png")}`,
      mimeType: src.media_type,
      url: `data:${src.media_type};base64,${src.data}`,
    };
  }
  return {
    id: `img-${idx}`,
    name: `image-${idx}`,
    mimeType: "image/*",
    url: src.url,
  };
}

function documentBlockToAttachment(
  block: AnthropicDocumentBlock,
  idx: number
): Attachment {
  const src = block.source;
  const name = block.title ?? `document-${idx}`;
  if (src.type === "url") return { id: `doc-${idx}`, name, url: src.url };
  if (src.type === "text") {
    return {
      id: `doc-${idx}`,
      name,
      mimeType: src.media_type,
      url: `data:${src.media_type};base64,${btoa(src.data)}`,
    };
  }
  return {
    id: `doc-${idx}`,
    name,
    mimeType: src.media_type,
    url: `data:${src.media_type};base64,${src.data}`,
  };
}

function toolResultContentToOutput(
  content: AnthropicToolResultBlock["content"]
): unknown {
  if (typeof content === "string") return safeParseJson(content);
  // List form — concatenate text blocks; images attach but rarely appear here.
  const text = content
    .filter((b): b is AnthropicTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return safeParseJson(text);
}

/* ------------ adapter ------------ */

export function anthropicToEvents(
  messages: AnthropicMessage[],
  opts: AnthropicAdapterOptions = {}
): ConversationEvent[] {
  const ctx = createAdapterContext(opts);
  const out: ConversationEvent[] = [];
  let lastAssistantIdx = -1;

  // Optional leading system prompt.
  if (opts.system) {
    const text =
      typeof opts.system === "string"
        ? opts.system
        : opts.system.map((b) => b.text).join("\n");
    if (text) {
      const sys: SystemMessageEvent = {
        id: ctx.newId(),
        type: "system_message",
        status: "complete",
        timestamp: ctx.tick(),
        content: text,
        raw: opts.system,
      };
      out.push(sys);
    }
  }

  for (const msg of messages) {
    const blocks = blocksOf(msg.content);

    if (msg.role === "user") {
      // Walk content blocks. Group text + media into one user_message; emit
      // tool_result blocks as their own events.
      const userTexts: string[] = [];
      const attachments: Attachment[] = [];
      const toolResults: ToolResultEvent[] = [];

      for (const block of blocks) {
        switch (block.type) {
          case "text":
            userTexts.push(block.text);
            break;
          case "image":
            attachments.push(imageBlockToAttachment(block, attachments.length));
            break;
          case "document":
            attachments.push(documentBlockToAttachment(block, attachments.length));
            break;
          case "tool_result": {
            const ts = ctx.tick((opts.stepMs ?? 100) / 2);
            toolResults.push({
              id: ctx.newId(),
              type: "tool_result",
              status: "complete",
              timestamp: ts,
              toolCallId: block.tool_use_id,
              durationMs: durationFromContext(ctx, block.tool_use_id, ts),
              output: toolResultContentToOutput(block.content),
              isError: block.is_error === true,
              raw: block,
            });
            break;
          }
          // tool_use / thinking / redacted_thinking shouldn't appear in user
          // messages, but skip them rather than fail loudly if a producer puts
          // them there.
          default:
            break;
        }
      }

      const hasUserContent = userTexts.length > 0 || attachments.length > 0;
      if (hasUserContent) {
        const u: UserMessageEvent = {
          id: ctx.newId(),
          type: "user_message",
          status: "complete",
          timestamp: ctx.tick(),
          content: userTexts.join("\n"),
          attachments: attachments.length > 0 ? attachments : undefined,
          raw: msg,
        };
        out.push(u);
      }
      // Tool results emit *after* the user content (mirrors timeline order).
      for (const tr of toolResults) out.push(tr);
      continue;
    }

    if (msg.role === "assistant") {
      // Order of emission matches plan §3.1: thinking first (since it
      // happened before output), then the message, then tool calls.
      for (const block of blocks) {
        if (block.type === "thinking") {
          const t: ThinkingEvent = {
            id: ctx.newId(),
            type: "thinking",
            status: "complete",
            timestamp: ctx.tick((opts.stepMs ?? 100) / 2),
            content: block.thinking,
            raw: block,
          };
          out.push(t);
        } else if (block.type === "redacted_thinking") {
          const t: ThinkingEvent = {
            id: ctx.newId(),
            type: "thinking",
            status: "complete",
            timestamp: ctx.tick((opts.stepMs ?? 100) / 2),
            content: "[redacted thinking — encrypted by the provider]",
            meta: { redacted: true, data: block.data },
            raw: block,
          };
          out.push(t);
        }
      }

      const text = textOf(blocks);
      const toolUses = blocks.filter(
        (b): b is AnthropicToolUseBlock => b.type === "tool_use"
      );

      const a: AssistantMessageEvent = {
        id: ctx.newId(),
        type: "assistant_message",
        status: "complete",
        timestamp: ctx.tick(),
        content: text,
        finishReason: toolUses.length > 0 ? "tool_calls" : "stop",
        raw: msg,
      };
      out.push(a);
      lastAssistantIdx = out.length - 1;

      for (const tu of toolUses) {
        const ts = ctx.tick((opts.stepMs ?? 100) / 2);
        ctx.callTimes.set(tu.id, ts);
        const c: ToolCallEvent = {
          id: ctx.newId(),
          type: "tool_call",
          status: "complete",
          timestamp: ts,
          toolCallId: tu.id,
          toolName: tu.name,
          input: tu.input,
          raw: tu,
        };
        out.push(c);
      }
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

/** Factory: returns a `MessageAdapter<AnthropicMessage>` bound to options. */
export function createAnthropicMessageAdapter(
  opts: AnthropicAdapterOptions = {}
): MessageAdapter<AnthropicMessage> {
  return {
    toEvents: (messages) => anthropicToEvents(messages, opts),
  };
}
