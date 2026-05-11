import type { ConversationEvent } from "../../types/events";

/**
 * Returns true when `event` contains `term` somewhere in its renderable
 * content. Case-insensitive. Walks the union exhaustively so a
 * not-yet-modeled event type is just a TS error away from being supported.
 */
export function eventMatches(event: ConversationEvent, term: string): boolean {
  if (!term) return false;
  const t = term.toLowerCase();

  switch (event.type) {
    case "user_message":
    case "assistant_message":
    case "thinking":
    case "system_message":
      if (event.content.toLowerCase().includes(t)) return true;
      // user_message attachments — search names too.
      if (event.type === "user_message") {
        for (const a of event.attachments ?? []) {
          if (a.name.toLowerCase().includes(t)) return true;
        }
      }
      return false;

    case "tool_call":
      if (event.toolName.toLowerCase().includes(t)) return true;
      return safeStringify(event.input).toLowerCase().includes(t);

    case "tool_result":
      if ((event.errorMessage ?? "").toLowerCase().includes(t)) return true;
      return safeStringify(event.output).toLowerCase().includes(t);

    case "compaction":
      return event.summary.toLowerCase().includes(t);

    case "error":
      return (
        event.message +
        " " +
        (event.code ?? "") +
        " " +
        (event.stack ?? "")
      )
        .toLowerCase()
        .includes(t);

    case "citation":
      return (
        (event.snippet ?? "") +
        " " +
        (event.sourceTitle ?? "") +
        " " +
        (event.sourceUrl ?? "")
      )
        .toLowerCase()
        .includes(t);
  }
}

export function findMatches(
  events: ConversationEvent[],
  term: string
): string[] {
  if (!term) return [];
  const out: string[] = [];
  for (const e of events) if (eventMatches(e, term)) out.push(e.id);
  return out;
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
