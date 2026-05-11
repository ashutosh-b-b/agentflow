import type { ReactNode } from "react";

export interface ScrollToBottomProps {
  /** Whether to render at all. Typically `!atBottom`. */
  visible: boolean;
  onClick: () => void;
  /** Optional override for the label. */
  children?: ReactNode;
  className?: string;
}

/**
 * Floating "jump to latest" affordance shown when the user has scrolled away
 * from the bottom of a live-tail conversation. Pair with `useAutoScroll`.
 */
export function ScrollToBottom({
  visible,
  onClick,
  children,
  className,
}: ScrollToBottomProps) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className={["ar-scroll-bottom", className].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-label="Scroll to latest"
    >
      {children ?? <>↓ Latest</>}
    </button>
  );
}
