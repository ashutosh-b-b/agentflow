import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationEvent } from "../../types/events";
import { findMatches } from "./match";
import { SearchContext, type SearchContextValue } from "./SearchContext";

export interface ConversationSearchProps {
  events: ConversationEvent[];
  /** Element inside which to scroll matches into view. Typically the same DOM
   *  subtree that renders the events. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Children render below the toolbar (typically a <ConversationView>). The
   *  toolbar wraps them in a SearchContext provider so highlight is automatic. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Search toolbar + provider. Walks events on every term change to compute the
 * set of matching event IDs; ↑/↓ cycle through them and scroll the current
 * match into view.
 */
export function ConversationSearch({
  events,
  scrollContainerRef,
  children,
  className,
}: ConversationSearchProps) {
  const [term, setTerm] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);

  const matches = useMemo(() => findMatches(events, term), [events, term]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  // If matches change (term changed, events changed), reset to the first.
  const matchesKey = matches.join(",");
  useEffect(() => {
    setCurrentIdx(0);
  }, [matchesKey]);

  const currentEventId = matches[currentIdx] ?? null;

  // Scroll the current match into view.
  const containerRef = scrollContainerRef ?? null;
  const lastJumpedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentEventId) return;
    if (lastJumpedRef.current === currentEventId) return;
    const root = containerRef?.current ?? document;
    const el = (root as HTMLElement | Document).querySelector?.(
      `[data-event-id="${cssEscape(currentEventId)}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      lastJumpedRef.current = currentEventId;
    }
  }, [currentEventId, containerRef]);

  const ctxValue: SearchContextValue = useMemo(
    () => ({ searchTerm: term, matches: matchSet, currentEventId }),
    [term, matchSet, currentEventId]
  );

  const hasTerm = term.trim().length > 0;
  const total = matches.length;
  const at = total > 0 ? currentIdx + 1 : 0;

  const next = () => setCurrentIdx((i) => (total === 0 ? 0 : (i + 1) % total));
  const prev = () =>
    setCurrentIdx((i) => (total === 0 ? 0 : (i - 1 + total) % total));
  const clear = () => {
    setTerm("");
    setCurrentIdx(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === "Escape") {
      e.preventDefault();
      clear();
    }
  };

  return (
    <SearchContext.Provider value={ctxValue}>
      <div className={["ar-search-wrap", className].filter(Boolean).join(" ")}>
        <div className="ar-search-bar" role="search">
          <span className="ar-search-icon" aria-hidden>⌕</span>
          <input
            type="search"
            className="ar-search-input"
            placeholder="Search conversation…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search conversation"
          />
          {hasTerm && (
            <>
              <span className="ar-search-count">
                {total > 0 ? `${at} / ${total}` : "no matches"}
              </span>
              <button
                type="button"
                className="ar-search-nav"
                onClick={prev}
                disabled={total === 0}
                aria-label="Previous match"
              >
                ↑
              </button>
              <button
                type="button"
                className="ar-search-nav"
                onClick={next}
                disabled={total === 0}
                aria-label="Next match"
              >
                ↓
              </button>
              <button
                type="button"
                className="ar-search-nav"
                onClick={clear}
                aria-label="Clear search"
              >
                ✕
              </button>
            </>
          )}
        </div>
        {children}
      </div>
    </SearchContext.Provider>
  );
}

/** CSS.escape polyfill for selector building (older browsers / tests). */
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
