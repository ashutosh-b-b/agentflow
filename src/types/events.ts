/**
 * Unified event format — see plan.md §3.2.
 *
 * Components only ever consume this format; provider adapters (OpenAI,
 * Anthropic, AG-UI) target it. Lossless when possible: every event carries
 * a `raw` field with the original upstream payload.
 *
 * This file currently includes the subset needed by the components built
 * so far (messages, tools). The remaining event types from §3.2 live here
 * too as stubs so the union stays exhaustive.
 */

export type EventStatus = "pending" | "streaming" | "complete" | "error";

export type EventType =
  | "user_message"
  | "assistant_message"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "compaction"
  | "system_message"
  | "error"
  | "citation";

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: number;
  status: EventStatus;
  threadId?: string;
  parentId?: string;
  raw?: unknown;
  meta?: Record<string, unknown>;
}

export interface Attachment {
  /** Stable ID inside the message — used as React key. */
  id?: string;
  name: string;
  mimeType?: string;
  /** URL or data URL — passed straight to ImageDisplay for image types. */
  url?: string;
  sizeBytes?: number;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface UserMessageEvent extends BaseEvent {
  type: "user_message";
  content: string;
  attachments?: Attachment[];
}

export interface AssistantMessageEvent extends BaseEvent {
  type: "assistant_message";
  content: string;
  finishReason?: "stop" | "tool_calls" | "length" | "error";
  usage?: TokenUsage;
}

export interface ThinkingEvent extends BaseEvent {
  type: "thinking";
  content: string;
  durationMs?: number;
}

/**
 * Permission state for a tool call. When the host gates execution (e.g. an
 * agent runtime that asks the user to confirm shell commands), this carries
 * the current decision so the UI can show a badge and / or Allow / Deny
 * buttons.
 */
export type ToolPermissionState = "pending" | "allowed" | "denied";

/**
 * A single tool invocation request.
 * `input` accumulates as JSON during streaming; `inputRaw` carries the partial
 * JSON string while it's still being parsed.
 */
export interface ToolCallEvent extends BaseEvent {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  input: unknown;
  inputRaw?: string;
  /** Permission state when the host gates execution. Default: undefined
   *  (treat as pre-approved — no badge rendered). */
  permission?: ToolPermissionState;
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool_result";
  toolCallId: string;
  output: unknown;
  isError?: boolean;
  errorMessage?: string;
  durationMs?: number;
  /**
   * Cost incurred by this tool call, in USD. When set, surfaces in the
   * ToolDisplay header next to the duration. Useful for LLM-as-tool or any
   * tool with a known per-call price.
   */
  costUsd?: number;
  /**
   * Token count consumed by this tool call. When set, surfaces in the
   * ToolDisplay header next to the duration / cost.
   */
  tokens?: number;
}

export interface CompactionEvent extends BaseEvent {
  type: "compaction";
  summary: string;
  compactedEventIds: string[];
  tokensBefore?: number;
  tokensAfter?: number;
}

export interface SystemMessageEvent extends BaseEvent {
  type: "system_message";
  content: string;
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  message: string;
  code?: string;
  retryable?: boolean;
  stack?: string;
}

export interface CitationEvent extends BaseEvent {
  type: "citation";
  sourceUrl?: string;
  sourceTitle?: string;
  snippet?: string;
  anchorEventId: string;
  anchorRange?: [number, number];
}

export type ConversationEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | CompactionEvent
  | SystemMessageEvent
  | ErrorEvent
  | CitationEvent;

export interface Conversation {
  id: string;
  events: ConversationEvent[];
  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------
 * Tool display contract — what variant components consume.
 * ------------------------------------------------------------------------- */

/** Status reported in the collapsed tool header. */
export type ToolStatus = "idle" | "running" | "complete" | "error";

/** Map an EventStatus + isError flag onto a ToolStatus. */
export function toolStatusFromEvent(
  event?: { status?: EventStatus },
  result?: { status?: EventStatus; isError?: boolean }
): ToolStatus {
  if (result?.isError || result?.status === "error" || event?.status === "error") return "error";
  if (result?.status === "complete") return "complete";
  if (event?.status === "streaming" || result?.status === "streaming") return "running";
  if (event?.status === "pending") return "idle";
  return "idle";
}
