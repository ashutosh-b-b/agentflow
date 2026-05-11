import { useState } from "react";
import type { ErrorEvent } from "../types/events";

export interface ErrorDisplayProps {
  event: ErrorEvent;
  /** Called when the user clicks Retry. The button is rendered when this is
   *  provided AND `event.retryable !== false`. */
  onRetry?: () => void;
  /** Default false — stack collapses behind a "Show stack trace" toggle. */
  defaultStackExpanded?: boolean;
  /** Inset variant — used inside another container (e.g. a tool body). */
  inset?: boolean;
  className?: string;
}

function frameCountOf(stack?: string): number {
  if (!stack) return 0;
  return stack.split("\n").filter((l) => l.trim()).length;
}

export function ErrorDisplay({
  event,
  onRetry,
  defaultStackExpanded = false,
  inset = false,
  className,
}: ErrorDisplayProps) {
  const [stackOpen, setStackOpen] = useState(defaultStackExpanded);
  const showRetry = event.retryable !== false && typeof onRetry === "function";
  const frames = frameCountOf(event.stack);

  return (
    <div
      className={[
        "ar-err",
        inset ? "inset" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div className="ico" aria-hidden>⚠</div>
      <div className="grow">
        <div className="err-title">
          {event.code ? `${event.code} — ` : ""}{event.message}
        </div>
        {event.code && event.message !== event.code && (
          <div className="err-detail">{event.message}</div>
        )}
        {event.stack && (
          <>
            <button
              type="button"
              className="ar-stack-toggle"
              onClick={() => setStackOpen((o) => !o)}
              aria-expanded={stackOpen}
            >
              {stackOpen ? "▾" : "▸"} {stackOpen ? "Hide" : "Show"} stack trace
              {!stackOpen && frames > 0 ? ` (${frames} frame${frames === 1 ? "" : "s"})` : ""}
            </button>
            {stackOpen && (
              <pre className="ar-stack-frames">{event.stack}</pre>
            )}
          </>
        )}
      </div>
      {showRetry && (
        <button
          type="button"
          className="ar-err-retry"
          onClick={onRetry}
        >
          ↻ Retry
        </button>
      )}
    </div>
  );
}
