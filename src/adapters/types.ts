/**
 * Adapter contract — see plan.md §5.
 *
 * Adapters convert a provider-specific message format into our normalized
 * ConversationEvent stream. They are the seam between transports / SDKs and
 * the rendering layer.
 */

import type { ConversationEvent } from "../types/events";

/**
 * Static (non-streaming) adapter shape.
 *
 * Given a complete log of messages in a provider's wire format, produce the
 * equivalent normalized event stream that a `<ConversationView>` can consume
 * directly.
 *
 * Streaming adapters (chunk → EventDelta) are a separate interface — see
 * plan §3.3 / §5; not yet exported.
 */
export interface MessageAdapter<TMessage> {
  toEvents(messages: TMessage[]): ConversationEvent[];
}

/**
 * Options shared by built-in adapters. Custom adapters that need ID and
 * timestamp synthesis should accept the same shape via `createAdapterContext`.
 */
export interface AdapterOptions {
  /** Base timestamp for the first event. Default `Date.now()`. */
  startTime?: number;
  /** Per-event time bump in milliseconds. Default 100. */
  stepMs?: number;
  /** Prefix for synthesized event IDs (`"${prefix}-${n}"`). Default `"evt"`. */
  idPrefix?: string;
}

/**
 * Adapter helpers — bundles ID generation, timestamp synthesis, and a tool
 * call-id → timestamp map for matching results back to their calls.
 *
 * Custom adapters compose these instead of reimplementing the boilerplate.
 */
export interface AdapterContext {
  /** Generate a fresh stable ID. Counter-based so output is deterministic. */
  newId(): string;
  /**
   * Advance the synthetic clock by `extraMs` (defaults to `stepMs` from
   * options) and return the new timestamp. Use this for every emitted event so
   * timestamps stay monotone.
   */
  tick(extraMs?: number): number;
  /**
   * Tool-call id → its emit timestamp. Populate when emitting a `tool_call`;
   * read when emitting the matching `tool_result` to compute `durationMs`.
   */
  callTimes: Map<string, number>;
}

export function createAdapterContext(opts: AdapterOptions = {}): AdapterContext {
  const stepMs = opts.stepMs ?? 100;
  const prefix = opts.idPrefix ?? "evt";
  let counter = 0;
  let cursor = opts.startTime ?? Date.now();
  return {
    newId: () => `${prefix}-${++counter}`,
    tick: (extra) => {
      cursor += extra ?? stepMs;
      return cursor;
    },
    callTimes: new Map(),
  };
}

/**
 * Best-effort `JSON.parse` that returns the original string if parsing fails.
 * Useful for tool-call argument fields and tool-result content fields that
 * arrive as strings but are usually JSON.
 */
export function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Compute `durationMs` for a tool result by looking up the matching call's
 * timestamp in the context. Returns undefined when no matching call is known.
 */
export function durationFromContext(
  ctx: AdapterContext,
  toolCallId: string,
  resultTimestamp: number
): number | undefined {
  const callTs = ctx.callTimes.get(toolCallId);
  return callTs == null ? undefined : Math.max(1, resultTimestamp - callTs);
}

export interface InferIsErrorOptions {
  /**
   * Exit codes that should NOT be treated as errors. Defaults to `[0]`.
   *
   * Useful for tools where non-zero exit doesn't actually mean failure:
   *   - ripgrep / `grep`: exit 1 = no matches
   *   - `git diff`: exit 1 = differences found
   *   - `cmp`: exit 1 = files differ
   *   - `jq`: exit 1 = no output produced
   */
  okExitCodes?: number[];
}

/**
 * Compute the `isError` flag for a tool_result event from its output payload.
 *
 * Looks up `exitCode` (and common synonyms — `exit_code`, `exit`, `status`,
 * `code`) on the output object. If the code is not in `okExitCodes`, returns
 * true. Returns false when no exit code is present (the tool didn't emit one,
 * so we don't speculate).
 *
 * Strictly exit-code-based — does NOT try to detect errors from arbitrary
 * output shapes (`{ error: "..." }`, prose containing "Traceback", etc.).
 * That kind of heuristic belongs in the consumer's adapter, where it can
 * reflect agent-specific conventions.
 */
export function inferIsError(
  output: unknown,
  opts: InferIsErrorOptions = {}
): boolean {
  if (output == null || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  const codeRaw =
    o.exitCode ?? o.exit_code ?? o.exit ?? o.status ?? o.code;
  if (typeof codeRaw !== "number" || !Number.isFinite(codeRaw)) return false;
  const ok = opts.okExitCodes ?? [0];
  return !ok.includes(codeRaw);
}

export type { ConversationEvent };
