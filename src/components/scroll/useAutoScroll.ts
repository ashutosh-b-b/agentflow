import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface UseAutoScrollOptions {
  /**
   * Pixels of slack at the bottom that still counts as "at the bottom".
   * Default 24 — wider than 0 because long-content reflow can leave a sub-pixel
   * gap that would otherwise yank the viewport away.
   */
  thresholdPx?: number;
}

export interface UseAutoScrollResult {
  atBottom: boolean;
  scrollToBottom: () => void;
}

/**
 * Live-tail scroll behavior for a fixed-height scroll container.
 *
 *   - `atBottom` reflects whether the user is currently at (within `thresholdPx` of)
 *     the bottom of the container.
 *   - When `atBottom` is true and `contentKey` changes (e.g. a new event arrived),
 *     the container is auto-scrolled to the bottom.
 *   - When `atBottom` is false, *no* scroll happens — the user's viewport is
 *     never yanked during a delta.
 *
 * `contentKey` is whatever you pass to indicate "content changed". Usually
 * `events.length` or a monotonically growing counter.
 */
export function useAutoScroll<T>(
  ref: React.RefObject<HTMLElement | null>,
  contentKey: T,
  opts: UseAutoScrollOptions = {}
): UseAutoScrollResult {
  const threshold = opts.thresholdPx ?? 24;
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  atBottomRef.current = atBottom;

  // Watch scroll position.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const next = dist <= threshold;
      if (next !== atBottomRef.current) setAtBottom(next);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    return () => el.removeEventListener("scroll", measure);
  }, [ref, threshold]);

  // Auto-scroll on content change — only when the user was already at bottom.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    // contentKey is the dependency that says "content changed"
  }, [ref, contentKey]);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [ref]);

  return { atBottom, scrollToBottom };
}
