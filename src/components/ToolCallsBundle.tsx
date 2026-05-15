import { useEffect, useState } from "react";
import type { ToolCallEvent } from "../types/events";
import { ToolCallRequestDisplay } from "./ToolCallRequestDisplay";
import type { ToolVariantComponent } from "./tool-variants/types";

export interface ToolCallsBundleProps {
  toolCalls: ToolCallEvent[];
  /** Tool name → variant overrides, forwarded to ToolCallRequestDisplay. */
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  /** Default false — collapsed shows compact one-liners per tool. */
  defaultExpanded?: boolean;
  /**
   * Forwarded to each inner `<ToolCallRequestDisplay>` — controls the
   * "Show more" toggle inside the input block. Default `true`.
   */
  inputCollapsible?: boolean;
  /** Override the bundle's title. */
  label?: string;
  className?: string;
}

/**
 * Compact one-line summary derived from a tool call's input. Used in the
 * bundle's collapsed-state row so an evaluator can glance and tell what the
 * agent actually called without expanding.
 */
function inputSummaryFor(toolName: string, input: unknown): string {
  if (input == null) return "";
  if (typeof input !== "object") return String(input);
  const i = input as Record<string, unknown>;
  switch (toolName) {
    case "read_file":
    case "write_file":
    case "str_replace":
    case "show_image":
      return String(i.path ?? i.src ?? "");
    case "bash":
    case "shell":
    case "exec":
      return String(i.command ?? "");
    case "grep":
    case "search": {
      const q = String(i.pattern ?? "");
      return i.path ? `"${q}" in ${i.path}` : `"${q}"`;
    }
    case "glob":
    case "find":
      return String(i.pattern ?? "");
    case "web_search":
      return `"${String(i.query ?? "")}"`;
  }
  try {
    const s = JSON.stringify(input);
    return s.length > 100 ? `${s.slice(0, 99)}…` : s;
  } catch {
    return "";
  }
}

function statusDotClass(call: ToolCallEvent): string {
  switch (call.status) {
    case "error": return "danger";
    case "complete": return "success"; // request fully formed
    case "streaming": return "accent pulse"; // input arguments still streaming
    case "pending": default: return "muted";
  }
}

export function ToolCallsBundle({
  toolCalls,
  toolVariants,
  defaultExpanded = false,
  inputCollapsible,
  label = "Tool Calls Requested",
  className,
}: ToolCallsBundleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Re-sync when the consumer flips the global default.
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  if (toolCalls.length === 0) return null;

  return (
    <div
      className={[
        "ar-tcb",
        expanded ? "open" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="ar-tcb-head"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="ar-tcb-title">{label}</span>
        <span className="ar-tcb-count">{toolCalls.length}</span>
        <span className="ar-tcb-chev" aria-hidden>›</span>
      </button>

      {!expanded && (
        <ul className="ar-tcb-summary">
          {toolCalls.map((call) => (
            <li key={call.id}>
              <span className={`ar-dot ${statusDotClass(call)}`} aria-hidden />
              <span className="tname">{call.toolName}</span>
              <span className="tinput">{inputSummaryFor(call.toolName, call.input)}</span>
            </li>
          ))}
        </ul>
      )}
      {expanded && (
        <div className="ar-tcb-body">
          {toolCalls.map((call) => (
            <ToolCallRequestDisplay
              key={call.id}
              event={call}
              variants={toolVariants}
              defaultExpanded
              inputCollapsible={inputCollapsible}
            />
          ))}
        </div>
      )}
    </div>
  );
}
