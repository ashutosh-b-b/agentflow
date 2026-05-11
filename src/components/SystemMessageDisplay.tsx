import { useCallback, useState } from "react";
import type { SystemMessageEvent } from "../types/events";

export interface SystemMessageDisplayProps {
  event: SystemMessageEvent;
  /**
   * - `'placeholder'` — small "system prompt hidden" affordance. Default in
   *   chat mode where surfacing the system prompt would be noise.
   * - `'block'` — full content block with SYSTEM eyebrow, metadata, and a
   *   bounded-scroll body. Default in devtool mode for debugging.
   * - `'hidden'` — render nothing (like the chat default with no placeholder).
   */
  display?: "placeholder" | "block" | "hidden";
  /** Sketch of the prompt's identity — e.g. a sha or version label. */
  shaLabel?: string;
  /** Override the bounded-scroll body height (block display). */
  bodyMaxHeight?: number;
  /** When true (default), block-display renders a Copy button. */
  copyable?: boolean;
  className?: string;
}

function approximateTokens(content: string): number {
  // Rough heuristic — ~4 chars/token. Good enough for a header tag.
  return Math.max(1, Math.round(content.length / 4));
}

export function SystemMessageDisplay({
  event,
  display = "block",
  shaLabel,
  bodyMaxHeight = 240,
  copyable = true,
  className,
}: SystemMessageDisplayProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    navigator.clipboard?.writeText(event.content).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {}
    );
  }, [event.content]);

  if (display === "hidden") return null;

  if (display === "placeholder") {
    return (
      <div
        className={["ar-sys-hidden", className].filter(Boolean).join(" ")}
        aria-label="system prompt hidden"
      >
        — system prompt hidden —
      </div>
    );
  }

  const tokens = approximateTokens(event.content);

  return (
    <div className={["ar-sys-block", className].filter(Boolean).join(" ")}>
      <div className="h">
        <span className="badge">SYSTEM</span>
        <span className="meta">
          ~{tokens.toLocaleString()} tok
          {shaLabel ? ` · sha ${shaLabel}` : ""}
        </span>
        {copyable && (
          <button
            type="button"
            className="btn ghost tiny"
            onClick={onCopy}
            style={{ marginLeft: "auto" }}
            aria-label="Copy system prompt"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="ar-sys-body" style={{ maxHeight: bodyMaxHeight }}>
        {event.content}
      </pre>
    </div>
  );
}
