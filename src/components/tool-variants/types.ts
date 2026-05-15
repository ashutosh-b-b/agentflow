import type { ComponentType } from "react";
import type { ToolPermissionState, ToolStatus } from "../../types/events";

/**
 * Merged tool event consumed by variants. Pairs the request-side (input) with
 * the result-side (output / error) into a single object so a variant can
 * render request + result inline.
 *
 * Builders (e.g. ToolCallRequestDisplay) merge a ToolCallEvent with its
 * matching ToolResultEvent — see plan §3.2.
 */
export interface ToolEventLike<Input = unknown, Output = unknown> {
  /** Tool name — keys the registry. */
  name: string;
  /** ID matching the upstream toolCallId — for keying / linking. */
  toolCallId?: string;
  status: ToolStatus;
  durationMs?: number;
  /** Cost in USD, forwarded to ToolDisplay's header chip. */
  costUsd?: number;
  /** Token count, forwarded to ToolDisplay's header chip. */
  tokens?: number;
  input: Input;
  /** Raw partial JSON during streaming — variants can ignore. */
  inputRaw?: string;
  output?: Output;
  isError?: boolean;
  errorMessage?: string;
  /** Permission state from a gated runtime, when present. Variants forward
   *  this to <ToolDisplay> so the header renders a badge + Allow/Deny. */
  permission?: ToolPermissionState;
}

/**
 * Which side(s) of a tool call to render.
 *
 * - `'request'` — input only. Used inside an AssistantMessage where the
 *   assistant has issued the call but the runtime hasn't produced a result yet.
 * - `'merged'`  — input + output stacked. Used by ToolCallResultDisplay so the
 *   result event carries enough context (what was asked) to stand on its own
 *   in the timeline.
 */
export type ToolVariantMode = "request" | "merged";

export interface ToolVariantProps<Input = unknown, Output = unknown> {
  event: ToolEventLike<Input, Output>;
  /** Default: 'merged'. */
  mode?: ToolVariantMode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * Whether the "Show more / Show less" toggle inside the **input** block is
   * available. Default `true`. When `false`, input renders in full with no
   * inner clamp/expand control. (The outer tool card's chevron is unaffected.)
   */
  inputCollapsible?: boolean;
  /**
   * Whether the "Show more / Show less" toggle inside the **output** block is
   * available. Default `true`. When `false`, output renders in full with no
   * inner clamp/expand control. (The outer tool card's chevron is unaffected.)
   */
  outputCollapsible?: boolean;
  bodyMaxHeight?: number;
  className?: string;
}

export type ToolVariantComponent<Input = unknown, Output = unknown> =
  ComponentType<ToolVariantProps<Input, Output>>;
