import { createContext, useContext } from "react";

export interface SearchContextValue {
  /** Current search term, lowercased for direct comparison. Empty when no search. */
  searchTerm: string;
  /** Event IDs that match the current term. */
  matches: ReadonlySet<string>;
  /** Currently focused match (the one to scroll into view). */
  currentEventId: string | null;
}

const DEFAULT: SearchContextValue = {
  searchTerm: "",
  matches: new Set(),
  currentEventId: null,
};

export const SearchContext = createContext<SearchContextValue>(DEFAULT);

/** Hook for components that wrap event renderings — returns flags to apply
 *  highlight classes. */
export function useEventSearchHighlight(eventId: string): {
  isMatch: boolean;
  isCurrent: boolean;
  searchTerm: string;
} {
  const ctx = useContext(SearchContext);
  return {
    isMatch: ctx.matches.has(eventId),
    isCurrent: ctx.currentEventId === eventId,
    searchTerm: ctx.searchTerm,
  };
}
