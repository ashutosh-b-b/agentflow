import { useCallback, useMemo, useState } from "react";
import { highlightLines, type HighlightedLine } from "./highlight";

export interface CodeDisplayProps {
  value: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  /** Max rendered height in pixels. Content beyond this scrolls inside. */
  maxHeight?: number;
  /** When true, render with an Expand bar that toggles `collapsedHeight`/`maxHeight`. */
  collapsible?: boolean;
  collapsedHeight?: number;
  /** Initial state when `collapsible`. Defaults to true (collapsed). */
  defaultCollapsed?: boolean;
  copyable?: boolean;
  /** Pre-tokenized lines (e.g. from a custom highlighter). Bypasses hljs. */
  lines?: HighlightedLine[];
  className?: string;
}

export function CodeDisplay({
  value,
  language,
  filename,
  showLineNumbers = true,
  highlightLines: highlightLinesProp,
  maxHeight = 400,
  collapsible = false,
  collapsedHeight = 120,
  defaultCollapsed = true,
  copyable = true,
  lines: linesProp,
  className,
}: CodeDisplayProps) {
  const lines = useMemo<HighlightedLine[]>(
    () => linesProp ?? highlightLines(value, language),
    [linesProp, value, language]
  );

  const [collapsed, setCollapsed] = useState<boolean>(collapsible && defaultCollapsed);
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {}
    );
  }, [value]);

  const hl = useMemo(() => new Set(highlightLinesProp ?? []), [highlightLinesProp]);

  const bodyStyle: React.CSSProperties = collapsed
    ? { maxHeight: collapsedHeight }
    : { maxHeight };

  const showHead = filename || language || copyable;
  const showExpandBar = collapsible && lines.length > 0;

  return (
    <div className={["ar-code", className].filter(Boolean).join(" ")}>
      {showHead && (
        <div className="ar-code-head">
          {language && <span className="lang">{language}</span>}
          {filename && <span className="file">{filename}</span>}
          <span className="spacer" />
          {copyable && (
            <button
              type="button"
              className="btn ghost tiny"
              onClick={onCopy}
              aria-label="Copy code"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      <div
        className={["ar-code-body", collapsed ? "collapsed" : ""].filter(Boolean).join(" ")}
        style={bodyStyle}
      >
        {lines.map((line, idx) => {
          const lineNo = idx + 1;
          const highlighted = hl.has(lineNo);
          return (
            <div
              key={idx}
              className={["ar-cl", highlighted ? "hl" : ""].filter(Boolean).join(" ")}
            >
              {showLineNumbers && <span className="g">{lineNo}</span>}
              <span
                className="s"
                // hljs only emits <span class="hljs-…"> tags; per-line HTML is
                // produced by our balancer in highlight.ts.
                dangerouslySetInnerHTML={{
                  __html: line.html.length === 0 ? "&nbsp;" : line.html,
                }}
              />
            </div>
          );
        })}
        {collapsed && <div className="ar-fade-bottom" aria-hidden />}
      </div>
      {showExpandBar && (
        <button
          type="button"
          className="ar-expand-bar"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? `▾ Expand · ${lines.length} lines` : `▴ Collapse`}
        </button>
      )}
    </div>
  );
}
