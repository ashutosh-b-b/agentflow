import { useState } from "react";
import { ImageDisplay } from "../primitives/ImageDisplay";
import { MarkdownDisplay } from "../primitives/MarkdownDisplay";
import type { Attachment, UserMessageEvent } from "../types/events";

export interface UserMessageProps {
  event: UserMessageEvent;
  /** Override the displayed name (top-of-bubble label). Default "you". */
  name?: string;
  /** Bound the content area to this many pixels. Default unbounded. */
  maxHeight?: number | null;
  /** Wrap long content in a "Show more" affordance. Default off. */
  collapsible?: boolean;
  collapsedHeight?: number;
  defaultCollapsed?: boolean;
  /**
   * Layout variant.
   * - `'bubble'` (default): right-aligned, gray bubble — chat-mode look.
   * - `'flat'`: full-width, no bubble — devtool-mode look.
   */
  variant?: "bubble" | "flat";
  className?: string;
}

function isImageAttachment(a: Attachment): boolean {
  if (a.mimeType?.startsWith("image/")) return true;
  if (a.url?.startsWith("data:image/")) return true;
  if (a.name && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.name)) return true;
  return false;
}

function formatBytes(n?: number): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UserMessage({
  event,
  name = "you",
  maxHeight,
  collapsible = false,
  collapsedHeight = 160,
  defaultCollapsed = true,
  variant = "bubble",
  className,
}: UserMessageProps) {
  const [collapsed, setCollapsed] = useState<boolean>(collapsible && defaultCollapsed);

  const showCollapsed = collapsible && collapsed;
  const contentStyle: React.CSSProperties =
    !showCollapsed && maxHeight != null
      ? { maxHeight, overflow: "auto" }
      : {};

  const collapsedStyle: React.CSSProperties = showCollapsed
    ? ({ ["--ar-collapsed-h" as string]: `${collapsedHeight}px` } as React.CSSProperties)
    : {};

  const imageAttachments = event.attachments?.filter(isImageAttachment) ?? [];
  const fileAttachments = event.attachments?.filter((a) => !isImageAttachment(a)) ?? [];

  return (
    <div
      className={[
        "ar-user-msg",
        variant === "flat" ? "flat" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div
        className={["body", showCollapsed ? "collapsed" : ""].filter(Boolean).join(" ")}
        style={collapsedStyle}
      >
        <div className="name">{name}</div>
        <div className="content" style={contentStyle}>
          <MarkdownDisplay value={event.content} />
        </div>
        {(imageAttachments.length > 0 || fileAttachments.length > 0) && (
          <div className="attachments">
            {imageAttachments.map((a, i) => (
              <ImageDisplay
                key={a.id ?? `img-${i}`}
                src={a.url ?? ""}
                alt={a.name}
                filename={a.name}
                sizeLabel={formatBytes(a.sizeBytes)}
                maxHeight={140}
              />
            ))}
            {fileAttachments.map((a, i) => (
              <span key={a.id ?? `file-${i}`} className="ar-chip">
                <span aria-hidden>📎</span>
                <span>{a.name}</span>
                {a.sizeBytes != null && <span>· {formatBytes(a.sizeBytes)}</span>}
              </span>
            ))}
          </div>
        )}
        {showCollapsed && (
          <button
            type="button"
            className="show-more"
            onClick={() => setCollapsed(false)}
          >
            ▾ Show more
          </button>
        )}
      </div>
    </div>
  );
}
