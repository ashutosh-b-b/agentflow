import { useMemo } from "react";
import type { ToolCallEvent, ToolResultEvent, ToolStatus } from "../types/events";
import { ToolCallProvider } from "./ToolCallContext";
import { DefaultToolDisplay, defaultToolVariants } from "./tool-variants/registry";
import type {
  ToolEventLike,
  ToolVariantComponent,
} from "./tool-variants/types";

export interface ToolCallResultDisplayProps {
  /**
   * The original tool-call event — required for tool-name routing and so the
   * merged view can display *what was asked* alongside the output.
   */
  call: ToolCallEvent;
  /** The result event (output / error / duration). */
  result: ToolResultEvent;
  /** Tool name → variant overrides, merged with defaults. */
  variants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  fallback?: ToolVariantComponent<unknown, unknown>;

  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * Forwarded to the variant — controls the "Show more" toggle inside the
   * input block. Default `true`. (Does not affect the outer card chevron.)
   */
  inputCollapsible?: boolean;
  /**
   * Forwarded to the variant — controls the "Show more" toggle inside the
   * output block. Default `true`. (Does not affect the outer card chevron.)
   */
  outputCollapsible?: boolean;
  bodyMaxHeight?: number;
  className?: string;
}

function statusFromResult(result: ToolResultEvent): ToolStatus {
  if (result.isError) return "error";
  if (result.status === "error") return "error";
  if (result.status === "complete") return "complete";
  if (result.status === "streaming") return "running";
  return "idle";
}

export function ToolCallResultDisplay({
  call,
  result,
  variants,
  fallback = DefaultToolDisplay,
  ...rest
}: ToolCallResultDisplayProps) {
  const merged: ToolEventLike = useMemo(() => ({
    name: call.toolName,
    toolCallId: call.toolCallId,
    status: statusFromResult(result),
    durationMs: result.durationMs,
    costUsd: result.costUsd,
    tokens: result.tokens,
    input: call.input,
    inputRaw: call.inputRaw,
    output: result.output,
    isError: result.isError,
    errorMessage: result.errorMessage,
    permission: call.permission,
  }), [call, result]);

  const Variant: ToolVariantComponent<unknown, unknown> =
    (variants && variants[call.toolName]) ??
    (defaultToolVariants[call.toolName] as ToolVariantComponent<unknown, unknown> | undefined) ??
    fallback;

  return (
    <ToolCallProvider kind="result">
      <div className="ar-tool-wrapper">
        <div className="ar-tool-eyebrow ar-tool-eyebrow-result">Result</div>
        <Variant event={merged} mode="merged" {...rest} />
      </div>
    </ToolCallProvider>
  );
}
