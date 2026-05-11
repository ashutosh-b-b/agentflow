import { useContext, type ReactNode } from "react";
import { SearchContext } from "./SearchContext";

export interface EventMatchWrapperProps {
  /**
   * Primary event id — used as the `data-event-id` (scroll target) and shown
   * in the URL hash if you wire that up. The first element of `eventIds` if
   * `eventIds` is supplied.
   */
  eventId: string;
  /**
   * Optional additional event ids that should *also* light up this wrapper.
   * Used so an `AssistantMessage` lights up when its folded `tool_call`
   * children match (e.g. searching for the tool's input).
   */
  additionalIds?: string[];
  children: ReactNode;
}

/**
 * Transparent wrapper that tags a rendered event group with `data-event-id`
 * (so `ConversationSearch` can find it and `scrollIntoView`) and applies the
 * match / current-match highlight classes when the search context says so.
 */
export function EventMatchWrapper({
  eventId,
  additionalIds,
  children,
}: EventMatchWrapperProps) {
  const ctx = useContext(SearchContext);
  const ids = additionalIds ? [eventId, ...additionalIds] : [eventId];
  const isMatch = ids.some((id) => ctx.matches.has(id));
  const isCurrent = ctx.currentEventId !== null && ids.includes(ctx.currentEventId);
  return (
    <div
      data-event-id={eventId}
      className={[
        "ar-event",
        isMatch ? "ar-event-match" : "",
        isCurrent ? "ar-event-current" : "",
      ].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
