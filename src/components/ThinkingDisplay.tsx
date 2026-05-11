import { useState } from "react";
import { MarkdownDisplay } from "../primitives/MarkdownDisplay";
import type { ThinkingEvent } from "../types/events";

export interface ThinkingDisplayProps {
  event: ThinkingEvent;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

function formatDuration(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function ThinkingDisplay({
  event,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  className,
}: ThinkingDisplayProps) {
  const [internal, setInternal] = useState(defaultExpanded);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : internal;
  const toggle = () => {
    const next = !expanded;
    if (!isControlled) setInternal(next);
    onExpandedChange?.(next);
  };

  const streaming = event.status === "streaming";
  const dur = formatDuration(event.durationMs);
  const summary = streaming
    ? "Thinking…"
    : dur
      ? `Thought for ${dur}`
      : "Thought";

  if (!expanded) {
    return (
      <button
        type="button"
        className={["ar-thinking-pill", className].filter(Boolean).join(" ")}
        onClick={toggle}
        aria-expanded={false}
      >
        <span className={`ar-dot purple${streaming ? " pulse" : ""}`} aria-hidden />
        <span>▸ {summary}</span>
      </button>
    );
  }

  return (
    <div className={["ar-thinking-block", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="ar-thinking-head"
        onClick={toggle}
        aria-expanded
      >
        <span className="eyebrow">
          ▾ Thinking{dur ? ` · ${dur}` : ""}
        </span>
      </button>
      <div className="ar-thinking-body">
        <MarkdownDisplay value={event.content} />
      </div>
    </div>
  );
}
