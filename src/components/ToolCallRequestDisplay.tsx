import { useMemo } from "react";
import type { ToolCallEvent, ToolStatus } from "../types/events";
import { ToolCallProvider } from "./ToolCallContext";
import { DefaultToolDisplay, defaultToolVariants } from "./tool-variants/registry";
import type {
  ToolEventLike,
  ToolVariantComponent,
} from "./tool-variants/types";

export interface ToolCallRequestDisplayProps {
  /** The request-side event. Renders input only (mode='request'). */
  event: ToolCallEvent;
  /** Tool name → variant overrides, merged with defaults. */
  variants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  /** Variant to use when no entry matches the tool name. */
  fallback?: ToolVariantComponent<unknown, unknown>;

  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * Forwarded to the variant — controls the "Show more" toggle inside the
   * input block. Default `true`. (Does not affect the outer card chevron.)
   */
  inputCollapsible?: boolean;
  bodyMaxHeight?: number;
  className?: string;
}

function statusFromEvent(event: ToolCallEvent): ToolStatus {
  switch (event.status) {
    case "error": return "error";
    case "streaming": return "running";   // input arguments are still streaming
    case "pending": return "idle";
    case "complete":
      // The request is fully formed — that's what `complete` means for a
      // ToolCallEvent. Whether the tool has executed is the *result* event's
      // concern (rendered separately by ToolCallResultDisplay), not ours.
      return "complete";
    default: return "idle";
  }
}

export function ToolCallRequestDisplay({
  event,
  variants,
  fallback = DefaultToolDisplay,
  ...rest
}: ToolCallRequestDisplayProps) {
  const merged: ToolEventLike = useMemo(() => ({
    name: event.toolName,
    toolCallId: event.toolCallId,
    status: statusFromEvent(event),
    input: event.input,
    inputRaw: event.inputRaw,
    permission: event.permission,
  }), [event]);

  const Variant: ToolVariantComponent<unknown, unknown> =
    (variants && variants[event.toolName]) ??
    (defaultToolVariants[event.toolName] as ToolVariantComponent<unknown, unknown> | undefined) ??
    fallback;

  return (
    <ToolCallProvider kind="request">
      <div className="ar-tool-wrapper">
        <div className="ar-tool-eyebrow ar-tool-eyebrow-request">Request</div>
        <Variant event={merged} mode="request" {...rest} />
      </div>
    </ToolCallProvider>
  );
}
