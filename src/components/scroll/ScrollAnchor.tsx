import { forwardRef } from "react";

/**
 * Invisible end-of-thread anchor. Place at the bottom of a scrollable thread
 * so consumers can call `ref.current.scrollIntoView()` to jump there
 * imperatively. The actual auto-scroll behavior lives in `useAutoScroll`.
 *
 * Mostly useful when you're composing the layout yourself and want a stable
 * jump target. `ConversationView` uses `useAutoScroll` directly and doesn't
 * need this, but external layouts can.
 */
export const ScrollAnchor = forwardRef<HTMLDivElement>((_props, ref) => (
  <div ref={ref} className="ar-scroll-anchor" aria-hidden style={{ height: 1 }} />
));
ScrollAnchor.displayName = "ScrollAnchor";
