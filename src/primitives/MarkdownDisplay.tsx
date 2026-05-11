import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeDisplay } from "./CodeDisplay";

export interface MarkdownDisplayProps {
  value: string;
  /** Override per-element renderers, react-markdown style. */
  components?: Components;
  /** Allow raw HTML in source. Default false (safe). */
  allowHtml?: boolean;
  /**
   * Bound the rendered area to this many pixels of vertical space.
   * `null` (default) = unbounded; oversized content grows the page.
   * Any number = scroll inside.
   */
  maxHeight?: number | null;
  /** Render with a "Show more" affordance when collapsed. */
  collapsible?: boolean;
  collapsedHeight?: number;
  defaultCollapsed?: boolean;
  className?: string;
}

const defaultComponents: Components = {
  // Map fenced code blocks → CodeDisplay
  code(props) {
    const { className, children, node, ...rest } = props as {
      className?: string;
      children?: React.ReactNode;
      node?: { tagName?: string };
    } & Record<string, unknown>;
    void node;

    const isInline = !className || !/language-/.test(className);
    if (isInline) {
      return <code {...rest}>{children}</code>;
    }
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    const value = String(children ?? "").replace(/\n$/, "");
    return <CodeDisplay value={value} language={lang} copyable />;
  },
  // react-markdown wraps fenced code in <pre><code>; we want <pre> to be a passthrough
  // so the CodeDisplay carries its own border / background.
  pre({ children }) {
    return <pre>{children}</pre>;
  },
};

export function MarkdownDisplay({
  value,
  components,
  allowHtml = false,
  maxHeight = null,
  collapsible = false,
  collapsedHeight = 200,
  defaultCollapsed = true,
  className,
}: MarkdownDisplayProps) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  // Whether the rendered content actually overflows the collapsedHeight.
  // Only when this is true do we show the "Show more" / "Show less" button —
  // otherwise the toggle has nothing to do and looks broken to the user.
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!collapsible) return;
    const el = innerRef.current;
    if (!el) return;
    const measure = () => {
      // scrollHeight is the unclamped intrinsic content height even when the
      // container has overflow:hidden + maxHeight.
      const overflows = el.scrollHeight > collapsedHeight + 1;
      setOverflowing(overflows);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, [collapsible, collapsedHeight, value]);

  const merged: Components = { ...defaultComponents, ...components };

  const bounded = maxHeight !== null;
  // Only clamp when the content actually overflows. Otherwise the toggle is
  // a no-op and we should look like a regular markdown block.
  const collapseActive = collapsible && collapsed && overflowing;

  // Inner div carries the clamp; the button is a sibling so it can never
  // overlay content. The outer wrapper exists so we have somewhere to put
  // the button without breaking the `.ar-md` selector that styles markdown.
  const innerStyle: React.CSSProperties = collapseActive
    ? { maxHeight: collapsedHeight, overflow: "hidden", position: "relative" }
    : bounded
      ? { maxHeight: maxHeight as number, overflow: "auto" }
      : {};

  const md = (
    <div
      ref={innerRef}
      className={[
        "ar-md",
        bounded ? "bounded" : "",
        collapseActive ? "collapsed" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={innerStyle}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={merged}>
        {value}
      </ReactMarkdown>
      {/* Fade-out at the bottom of a clamped block so the cut-off reads as
          intentional rather than "page didn't load". */}
      {collapseActive && <div className="ar-md-fade" aria-hidden />}
    </div>
  );

  if (!collapsible || !overflowing) return md;

  return (
    <div className="ar-md-collapsible">
      {md}
      <button
        type="button"
        className="ar-expand-bar"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? "▾ Show more" : "▴ Show less"}
      </button>
    </div>
  );
  // Note: `allowHtml` is currently unused — react-markdown 9 strips raw HTML
  // by default; allow-list opt-in would require rehype-raw (lazy).
  void allowHtml;
}
