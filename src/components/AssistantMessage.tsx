import type { ReactNode } from "react";
import { MarkdownDisplay } from "../primitives/MarkdownDisplay";
import type {
  AssistantMessageEvent,
  ToolCallEvent,
} from "../types/events";
import { ToolCallRequestDisplay } from "./ToolCallRequestDisplay";
import { ToolCallsBundle } from "./ToolCallsBundle";
import type { ToolVariantComponent } from "./tool-variants/types";

/**
 * How tool-call requests issued by this assistant turn are rendered inline.
 *
 * - `'full'`      — full ToolCallRequestDisplay card (input only).
 * - `'name-only'` — compact pill: status dot + tool name.
 * - `'none'`      — skip rendering tool calls inline.
 */
export type ToolCallDisplayMode = "full" | "name-only" | "none";

export interface AssistantMessageProps {
  event: AssistantMessageEvent;
  /**
   * Tool-call requests issued by this turn — rendered inline below the body.
   *
   * Tool *results* are NOT passed here; they are separate events in the
   * conversation timeline and are rendered by `<ToolCallResultDisplay>`.
   */
  toolCalls?: ToolCallEvent[];
  /** Default 'full'. */
  toolCallDisplay?: ToolCallDisplayMode;
  /** Tool name → variant overrides. Forwarded to ToolCallRequestDisplay. */
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  /** Avatar element. Defaults to a single letter from `name`. */
  avatar?: ReactNode;
  /** Display name. Defaults to "Assistant". */
  name?: string;
  /** Show meta info next to the name (e.g. "· streaming"). Default true. */
  showMeta?: boolean;
  /**
   * Layout variant.
   * - `'bubble'` (default): avatar + body — chat-mode look.
   * - `'flat'`: no avatar, full-width body — devtool-mode look.
   */
  variant?: "bubble" | "flat";
  /**
   * Default expansion for tool-request cards inlined under this message.
   * In `'bubble'` variant this controls each `<ToolCallRequestDisplay>`'s
   * defaultExpanded; in `'flat'` variant it controls the `<ToolCallsBundle>`'s
   * own collapsed/expanded state. Undefined = component-internal default.
   */
  toolRequestDefaultExpanded?: boolean;
  /**
   * Forwarded as `inputCollapsible` to each inline `<ToolCallRequestDisplay>` —
   * controls the "Show more" toggle inside the input block, not the outer
   * chevron. Default `true`.
   */
  toolInputCollapsible?: boolean;
  className?: string;
}

function defaultAvatar(name: string): ReactNode {
  return name.slice(0, 1).toUpperCase();
}

export function AssistantMessage({
  event,
  toolCalls,
  toolCallDisplay = "full",
  toolVariants,
  avatar,
  name = "Assistant",
  showMeta = true,
  variant = "bubble",
  toolRequestDefaultExpanded,
  toolInputCollapsible = true,
  className,
}: AssistantMessageProps) {
  const streaming = event.status === "streaming";

  const meta = (() => {
    if (streaming) return "· streaming";
    if (event.usage?.outputTokens != null) {
      return `· ${event.usage.outputTokens.toLocaleString()} tok`;
    }
    if (event.finishReason && event.finishReason !== "stop") {
      return `· ${event.finishReason}`;
    }
    return null;
  })();

  return (
    <div
      className={[
        "ar-asst-msg",
        streaming ? "streaming" : "",
        variant === "flat" ? "flat" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {variant === "bubble" && (
        <div className="avatar" aria-hidden>
          {avatar ?? defaultAvatar(name)}
        </div>
      )}
      <div className="body">
        {(name || meta) && (
          <div className="head">
            {name && <span className="aname">{name}</span>}
            {showMeta && meta && <span className="ar-meta">{meta}</span>}
          </div>
        )}
        {variant === "flat" ? (
          <FlatBody
            event={event}
            toolCalls={toolCalls}
            toolCallDisplay={toolCallDisplay}
            toolVariants={toolVariants}
            toolRequestDefaultExpanded={toolRequestDefaultExpanded}
            toolInputCollapsible={toolInputCollapsible}
          />
        ) : (
          <BubbleBody
            event={event}
            toolCalls={toolCalls}
            toolCallDisplay={toolCallDisplay}
            toolVariants={toolVariants}
            toolRequestDefaultExpanded={toolRequestDefaultExpanded}
            toolInputCollapsible={toolInputCollapsible}
          />
        )}
      </div>
    </div>
  );
}

interface BodyProps {
  event: AssistantMessageEvent;
  toolCalls?: ToolCallEvent[];
  toolCallDisplay: ToolCallDisplayMode;
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  toolRequestDefaultExpanded?: boolean;
  toolInputCollapsible?: boolean;
}

/* ----- bubble (chat mode) ----- */
function BubbleBody({
  event,
  toolCalls,
  toolCallDisplay,
  toolVariants,
  toolRequestDefaultExpanded,
  toolInputCollapsible,
}: BodyProps) {
  return (
    <>
      <div className="text">
        <MarkdownDisplay value={event.content} />
      </div>
      {toolCalls && toolCalls.length > 0 && toolCallDisplay !== "none" && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {toolCalls.map((tc) => (
            <ToolCallView
              key={tc.id}
              call={tc}
              mode={toolCallDisplay}
              variants={toolVariants}
              defaultExpanded={toolRequestDefaultExpanded}
              inputCollapsible={toolInputCollapsible}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ToolCallView({
  call,
  mode,
  variants,
  defaultExpanded,
  inputCollapsible,
}: {
  call: ToolCallEvent;
  mode: Exclude<ToolCallDisplayMode, "none">;
  variants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  defaultExpanded?: boolean;
  inputCollapsible?: boolean;
}) {
  if (mode === "name-only") {
    const dotClass =
      call.status === "error"
        ? "danger"
        : call.status === "complete"
          ? "success" // request fully formed
          : call.status === "pending"
            ? "muted"
            : "accent pulse"; // streaming input
    return (
      <span className="ar-tool-pill">
        <span className={`ar-dot ${dotClass}`} aria-hidden />
        <span>{call.toolName}</span>
      </span>
    );
  }
  return (
    <ToolCallRequestDisplay
      event={call}
      variants={variants}
      defaultExpanded={defaultExpanded}
      inputCollapsible={inputCollapsible}
    />
  );
}

/* -----------------------------------------------------------------
 * Flat (devtool) layout — collapsible text + ToolCallsBundle.
 *
 * Per the wireframe:
 *   Default view:
 *     [Assistant Message Text — collapsed]
 *     [Tool Calls Requested ▾]
 *       - read_file: src/api/client.ts
 *       - bash: npm test --workspace
 *
 *   Tool-expanded view:
 *     [Assistant Message Text — collapsed]
 *     [Tool Calls Requested ▴]
 *       <ToolCallRequestDisplay: read_file>
 *       <ToolCallRequestDisplay: bash>
 *
 * The text and the tool-bundle each have their own collapse toggle so an
 * evaluator can scan first and drill in selectively.
 * ----------------------------------------------------------------- */
function FlatBody({
  event,
  toolCalls,
  toolCallDisplay,
  toolVariants,
  toolRequestDefaultExpanded,
  toolInputCollapsible,
}: BodyProps) {
  const showBundle = toolCalls && toolCalls.length > 0 && toolCallDisplay !== "none";
  return (
    <div className="ar-asst-flat-card">
      <div className="text">
        <MarkdownDisplay
          value={event.content}
          collapsible
          collapsedHeight={80}
          defaultCollapsed
        />
      </div>
      {showBundle && (
        <ToolCallsBundle
          toolCalls={toolCalls!}
          toolVariants={toolVariants}
          defaultExpanded={toolRequestDefaultExpanded ?? false}
          inputCollapsible={toolInputCollapsible}
        />
      )}
    </div>
  );
}
