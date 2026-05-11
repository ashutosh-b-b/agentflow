import { useState } from "react";
import { MarkdownDisplay } from "../primitives/MarkdownDisplay";
import type { CompactionEvent } from "../types/events";

export interface CompactionDisplayProps {
  event: CompactionEvent;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** When the user clicks one of the compacted-event-id badges. */
  onEventIdClick?: (eventId: string) => void;
  className?: string;
}

function formatTokens(n?: number): string {
  if (n == null) return "";
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

function tokensSaved(before?: number, after?: number): string | null {
  if (before == null || after == null) return null;
  const saved = before - after;
  if (saved <= 0) return null;
  return formatTokens(saved);
}

export function CompactionDisplay({
  event,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  onEventIdClick,
  className,
}: CompactionDisplayProps) {
  const [internal, setInternal] = useState(defaultExpanded);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : internal;
  const toggle = () => {
    const next = !expanded;
    if (!isControlled) setInternal(next);
    onExpandedChange?.(next);
  };

  const count = event.compactedEventIds.length;
  const saved = tokensSaved(event.tokensBefore, event.tokensAfter);

  if (!expanded) {
    return (
      <button
        type="button"
        className={["ar-compaction-rule", className].filter(Boolean).join(" ")}
        onClick={toggle}
        aria-expanded={false}
      >
        <span className="line" aria-hidden />
        <span>
          ▸ <span className="num">{count}</span> earlier message
          {count === 1 ? "" : "s"} summarized
          {saved && <> — saved <span className="num">{saved}</span> tokens</>}
        </span>
        <span className="line" aria-hidden />
      </button>
    );
  }

  // Render a small preview cap for the id badges so a 200-event compaction
  // doesn't blow out the timeline.
  const PREVIEW = 8;
  const previewIds = event.compactedEventIds.slice(0, PREVIEW);
  const moreCount = event.compactedEventIds.length - previewIds.length;

  return (
    <div className={["ar-compaction-expanded", className].filter(Boolean).join(" ")}>
      <div className="ar-compaction-head">
        <button type="button" className="ar-compaction-toggle" onClick={toggle}>
          <span className="badge">▾ Compaction</span>
        </button>
        <span className="meta">
          {count} event{count === 1 ? "" : "s"}
          {event.tokensBefore != null && event.tokensAfter != null && (
            <>
              {" "}· {formatTokens(event.tokensBefore)} → {formatTokens(event.tokensAfter)} tok
              {saved && <> · saved {saved}</>}
            </>
          )}
        </span>
      </div>
      <div className="ar-compaction-body">
        <MarkdownDisplay value={event.summary} />
      </div>
      {previewIds.length > 0 && (
        <div className="ar-compaction-ids">
          {previewIds.map((id) => (
            <button
              key={id}
              type="button"
              className="ar-compaction-id"
              onClick={() => onEventIdClick?.(id)}
              disabled={!onEventIdClick}
            >
              {id}
            </button>
          ))}
          {moreCount > 0 && (
            <span className="ar-compaction-id ar-compaction-id-more">+{moreCount} more</span>
          )}
        </div>
      )}
    </div>
  );
}
