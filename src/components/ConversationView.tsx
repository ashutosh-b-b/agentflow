import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type {
  AssistantMessageEvent,
  ConversationEvent,
  ToolCallEvent,
  ToolResultEvent,
  UserMessageEvent,
} from "../types/events";
import { JsonDisplay } from "../primitives/JsonDisplay";
import { ConversationSearch } from "./search/ConversationSearch";
import { EventMatchWrapper } from "./search/EventMatchWrapper";
import { ScrollToBottom, useAutoScroll } from "./scroll";
import { ToolPermissionProvider } from "./permission/ToolPermissionContext";
import {
  AssistantMessage,
  type AssistantMessageProps,
} from "./AssistantMessage";
import {
  CompactionDisplay,
  type CompactionDisplayProps,
} from "./CompactionDisplay";
import { ErrorDisplay, type ErrorDisplayProps } from "./ErrorDisplay";
import {
  SystemMessageDisplay,
  type SystemMessageDisplayProps,
} from "./SystemMessageDisplay";
import { ThinkingDisplay, type ThinkingDisplayProps } from "./ThinkingDisplay";
import {
  ToolCallRequestDisplay,
  type ToolCallRequestDisplayProps,
} from "./ToolCallRequestDisplay";
import {
  ToolCallResultDisplay,
  type ToolCallResultDisplayProps,
} from "./ToolCallResultDisplay";
import { UserMessage, type UserMessageProps } from "./UserMessage";
import type { ToolVariantComponent } from "./tool-variants/types";

/**
 * Component overrides accepted by `<ConversationView components={...} />`.
 * Override receives the same props as the default — see each component's own
 * `*Props` interface for the full signature.
 */
export interface ConversationComponents {
  UserMessage: ComponentType<UserMessageProps>;
  AssistantMessage: ComponentType<AssistantMessageProps>;
  ToolCallRequestDisplay: ComponentType<ToolCallRequestDisplayProps>;
  ToolCallResultDisplay: ComponentType<ToolCallResultDisplayProps>;
  ThinkingDisplay: ComponentType<ThinkingDisplayProps>;
  CompactionDisplay: ComponentType<CompactionDisplayProps>;
  ErrorDisplay: ComponentType<ErrorDisplayProps>;
  SystemMessageDisplay: ComponentType<SystemMessageDisplayProps>;
}

const DEFAULT_COMPONENTS: ConversationComponents = {
  UserMessage,
  AssistantMessage,
  ToolCallRequestDisplay,
  ToolCallResultDisplay,
  ThinkingDisplay,
  CompactionDisplay,
  ErrorDisplay,
  SystemMessageDisplay,
};

/**
 * Conversation rendering modes.
 *
 * - `'chat'`      — single-column thread, chat-bubble alignment, assistant
 *                   message folds its tool requests inline. Default.
 * - `'devtool'`   — single-column flat timeline. No bubble alignment, no avatar.
 *                   Tool calls and tool results render as standalone, expanded
 *                   events. System messages visible. Per plan §7.2.
 * - `'inspector'` — 3-pane debug view: filters, event-row table, raw-JSON
 *                   inspector. Useful for debugging, less so for reading.
 */
export type ConversationMode = "chat" | "devtool" | "inspector";

export interface ConversationViewProps {
  events: ConversationEvent[];
  mode?: ConversationMode;
  /** Optional metadata shown in the devtool sidebar. */
  metadata?: { title?: string; model?: string; [k: string]: unknown };
  /** Tool name → variant overrides. */
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  /**
   * Component overrides — swap any of the default secondaries for your own.
   * Custom components receive the same props as the default; see
   * `docs/example-custom-assistant.md`.
   */
  components?: Partial<ConversationComponents>;
  /** Render a search toolbar above the conversation shell. Default false. */
  showSearch?: boolean;
  /**
   * Default expansion for `<ToolCallRequestDisplay>` cards. When undefined,
   * uses the mode-aware default (collapsed in chat, expanded in devtool).
   */
  toolRequestDefaultExpanded?: boolean;
  /**
   * Default expansion for `<ToolCallResultDisplay>` cards. When undefined,
   * uses the mode-aware default (collapsed in chat, expanded in devtool).
   * Pending-permission tool calls always auto-expand regardless.
   */
  toolResultDefaultExpanded?: boolean;
  /**
   * Show the "Show more / Show less" toggle inside the **input** block of tool
   * cards (both request and result). Default `true`. When `false`, the input
   * content renders in full with no inner clamp — the outer card chevron is
   * unaffected.
   */
  expandToolInputBtn?: boolean;
  /**
   * Show the "Show more / Show less" toggle inside the **output** block of the
   * result card. Default `true`. When `false`, the output content renders in
   * full with no inner clamp — the outer card chevron is unaffected.
   */
  expandToolOutputBtn?: boolean;
  /** Called when the user clicks Allow on a `permission: 'pending'` tool call. */
  onAllowToolCall?: (toolCallId: string) => void;
  /** Called when the user clicks Deny on a `permission: 'pending'` tool call. */
  onDenyToolCall?: (toolCallId: string) => void;
  className?: string;
}

/* --------------------------------------------------------------------- *
 * Grouping — chat mode collapses an assistant_message + the tool_calls
 * that follow it (until the next user/assistant message) into one item.
 * Tool results render as separate items in timeline order.
 * --------------------------------------------------------------------- */
type ChatItem =
  | { kind: "user"; event: UserMessageEvent }
  | { kind: "assistant"; event: AssistantMessageEvent; toolCalls: ToolCallEvent[] }
  | { kind: "tool_result"; call: ToolCallEvent; result: ToolResultEvent }
  | { kind: "orphan_tool_call"; call: ToolCallEvent }
  | { kind: "orphan_tool_result"; result: ToolResultEvent }
  | { kind: "passthrough"; event: ConversationEvent };

function buildChatItems(events: ConversationEvent[]): ChatItem[] {
  const out: ChatItem[] = [];
  // Pre-build a map for quick toolCallId → ToolCallEvent lookup.
  const callById = new Map<string, ToolCallEvent>();
  for (const e of events) {
    if (e.type === "tool_call") callById.set(e.toolCallId, e);
  }
  // Track which tool_call events have been folded into an assistant turn
  // so we don't double-render them.
  const consumedCallIds = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    switch (event.type) {
      case "user_message": {
        out.push({ kind: "user", event });
        break;
      }
      case "assistant_message": {
        const toolCalls: ToolCallEvent[] = [];
        // Greedy: gather contiguous tool_calls following this message.
        let j = i + 1;
        while (j < events.length && events[j].type === "tool_call") {
          const tc = events[j] as ToolCallEvent;
          toolCalls.push(tc);
          consumedCallIds.add(tc.id);
          j++;
        }
        out.push({ kind: "assistant", event, toolCalls });
        i = j - 1;
        break;
      }
      case "tool_call": {
        if (consumedCallIds.has(event.id)) break;
        out.push({ kind: "orphan_tool_call", call: event });
        break;
      }
      case "tool_result": {
        const call = callById.get(event.toolCallId);
        if (call) out.push({ kind: "tool_result", call, result: event });
        else out.push({ kind: "orphan_tool_result", result: event });
        break;
      }
      default: {
        out.push({ kind: "passthrough", event });
        break;
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------------- *
 * Chat mode
 * --------------------------------------------------------------------- */
function ChatThread({
  items,
  toolVariants,
  components,
  expansion,
}: {
  items: ChatItem[];
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  components: ConversationComponents;
  expansion: ExpansionDefaults;
}) {
  return (
    <>
      {items.map((item) =>
        renderChatItem(item, "chat", toolVariants, components, expansion)
      )}
    </>
  );
}

/**
 * Render one chat-style item, wrapped in an EventMatchWrapper so search
 * highlighting + scroll-into-view work without the variant components needing
 * to know about search.
 */
function renderChatItem(
  item: ChatItem,
  mode: "chat" | "devtool",
  toolVariants: Record<string, ToolVariantComponent<unknown, unknown>> | undefined,
  C: ConversationComponents,
  expansion: ExpansionDefaults
) {
  // Mode-aware fallback: collapsed in chat, expanded in devtool. Consumer
  // overrides via toolRequestDefaultExpanded / toolResultDefaultExpanded
  // take precedence.
  const requestExpanded =
    expansion.toolRequest !== undefined ? expansion.toolRequest : mode === "devtool";
  const resultExpanded =
    expansion.toolResult !== undefined ? expansion.toolResult : mode === "devtool";
  const inputCollapsible = expansion.inputCollapsible ?? true;
  const outputCollapsible = expansion.outputCollapsible ?? true;
  switch (item.kind) {
    case "user":
      return (
        <EventMatchWrapper key={item.event.id} eventId={item.event.id}>
          <C.UserMessage
            event={item.event}
            variant={mode === "devtool" ? "flat" : undefined}
            name={mode === "devtool" ? "user" : undefined}
          />
        </EventMatchWrapper>
      );
    case "assistant": {
      const toolCallIds = item.toolCalls.map((tc) => tc.id);
      return (
        <EventMatchWrapper
          key={item.event.id}
          eventId={item.event.id}
          additionalIds={toolCallIds}
        >
          <C.AssistantMessage
            event={item.event}
            toolCalls={item.toolCalls}
            toolVariants={toolVariants}
            variant={mode === "devtool" ? "flat" : undefined}
            name={mode === "devtool" ? "assistant" : undefined}
            toolRequestDefaultExpanded={expansion.toolRequest}
            toolInputCollapsible={inputCollapsible}
          />
        </EventMatchWrapper>
      );
    }
    case "tool_result":
      return (
        <EventMatchWrapper
          key={item.result.id}
          eventId={item.result.id}
          additionalIds={[item.call.id]}
        >
          <C.ToolCallResultDisplay
            call={item.call}
            result={item.result}
            variants={toolVariants}
            defaultExpanded={resultExpanded}
            inputCollapsible={inputCollapsible}
            outputCollapsible={outputCollapsible}
          />
        </EventMatchWrapper>
      );
    case "orphan_tool_call":
      return (
        <EventMatchWrapper key={item.call.id} eventId={item.call.id}>
          <C.ToolCallRequestDisplay
            event={item.call}
            variants={toolVariants}
            defaultExpanded={requestExpanded}
            inputCollapsible={inputCollapsible}
          />
        </EventMatchWrapper>
      );
    case "orphan_tool_result":
      // Best-effort fallback: render the raw payload as a JSON tree
      // since we don't have a matching call to route by.
      return (
        <EventMatchWrapper key={item.result.id} eventId={item.result.id}>
          <JsonDisplay value={item.result} />
        </EventMatchWrapper>
      );
    case "passthrough":
      return (
        <EventMatchWrapper key={item.event.id} eventId={item.event.id}>
          {renderSecondaryBody(item.event, mode, C)}
        </EventMatchWrapper>
      );
    default: {
      const _exhaust: never = item;
      return _exhaust;
    }
  }
}

/**
 * Render the body of a "non-conversation-skeleton" event (thinking /
 * compaction / system_message / error / citation). Mode-aware defaults follow
 * plan §7.2. The caller is responsible for the EventMatchWrapper.
 */
function renderSecondaryBody(
  event: ConversationEvent,
  mode: "chat" | "devtool",
  C: ConversationComponents
) {
  switch (event.type) {
    case "thinking":
      return <C.ThinkingDisplay event={event} defaultExpanded={mode === "devtool"} />;
    case "compaction":
      // Collapsed default in both modes per §7.2.
      return <C.CompactionDisplay event={event} />;
    case "system_message":
      return (
        <C.SystemMessageDisplay
          event={event}
          display={mode === "chat" ? "placeholder" : "block"}
        />
      );
    case "error":
      // Errors show fully-expanded in both modes (the user always wants the
      // message). Stack collapse happens inside ErrorDisplay.
      return <C.ErrorDisplay event={event} />;
    default:
      // citation + anything we don't model yet — JSON tree fallback so the
      // payload is still navigable.
      return <JsonDisplay value={event} />;
  }
}

/* --------------------------------------------------------------------- *
 * Devtool mode — single-column flat timeline.
 *
 * Per plan §7.2: tool requests/results render as separate events (not merged),
 * messages show without chat-bubble alignment, system messages visible,
 * everything default-expanded.
 * --------------------------------------------------------------------- */

/** Distinct tool names appearing across this thread's items. */
function distinctToolNames(items: ChatItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    switch (item.kind) {
      case "tool_result":
        set.add(item.call.toolName);
        break;
      case "orphan_tool_call":
        set.add(item.call.toolName);
        break;
      case "assistant":
        for (const tc of item.toolCalls) set.add(tc.toolName);
        break;
    }
  }
  return [...set].sort();
}

/** Tool name attached to a top-level tool item (used for the Tool Messages filter). */
function toolNameOf(item: ChatItem): string | null {
  switch (item.kind) {
    case "tool_result": return item.call.toolName;
    case "orphan_tool_call": return item.call.toolName;
    default: return null;
  }
}

function isFailedItem(item: ChatItem): boolean {
  switch (item.kind) {
    case "tool_result":
      return item.result.isError === true || item.result.status === "error";
    case "orphan_tool_result":
      return item.result.isError === true || item.result.status === "error";
    case "passthrough":
      return item.event.type === "error" || item.event.status === "error";
    case "assistant":
      return item.event.status === "error";
    default:
      return false;
  }
}

function DevtoolView({
  items,
  toolVariants,
  components,
  expansion,
  scrollRef,
}: {
  items: ChatItem[];
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  components: ConversationComponents;
  expansion: ExpansionDefaults;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const { atBottom, scrollToBottom } = useAutoScroll(scrollRef, items.length);

  const toolNames = useMemo(() => distinctToolNames(items), [items]);

  const counts = useMemo(() => {
    const out = {
      user: 0,
      assistant: 0,
      toolByName: {} as Record<string, number>,
      failed: 0,
    };
    for (const item of items) {
      if (item.kind === "user") out.user++;
      if (item.kind === "assistant") out.assistant++;
      const name = toolNameOf(item);
      if (name) out.toolByName[name] = (out.toolByName[name] ?? 0) + 1;
      if (isFailedItem(item)) out.failed++;
    }
    return out;
  }, [items]);

  const [enabledUser, setEnabledUser] = useState(true);
  const [enabledAssistant, setEnabledAssistant] = useState(true);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(
    () => new Set(toolNames)
  );
  // Tri-state status filter — exactly one active at a time.
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");

  // Keep newly-observed tool names enabled by default — preserves the user's
  // existing disabled set across streaming additions.
  useEffect(() => {
    setEnabledTools((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const n of toolNames) {
        if (!next.has(n) && !prev.has(n)) {
          // Brand-new name we haven't seen: enable.
          next.add(n);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [toolNames]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (item.kind === "user" && !enabledUser) return false;
        if (item.kind === "assistant" && !enabledAssistant) return false;
        const name = toolNameOf(item);
        if (name && !enabledTools.has(name)) return false;
        const failed = isFailedItem(item);
        if (statusFilter === "passed" && failed) return false;
        if (statusFilter === "failed" && !failed) return false;
        return true;
      }),
    [items, enabledUser, enabledAssistant, enabledTools, statusFilter]
  );

  const toggleTool = (name: string) => {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="ar-devtool-shell">
      <aside className="ar-devtool-side">
        <section>
          <h5>Filter</h5>
          <div className="ar-ftree">
            <div className="ar-fgrp">
              <div className="ar-fgrp-h">Messages</div>
              <div className="ar-fgrp-c">
                {counts.user > 0 && (
                  <FilterRow
                    label="User Message"
                    count={counts.user}
                    on={enabledUser}
                    onToggle={() => setEnabledUser((v) => !v)}
                  />
                )}
                {counts.assistant > 0 && (
                  <FilterRow
                    label="Assistant Message"
                    count={counts.assistant}
                    on={enabledAssistant}
                    onToggle={() => setEnabledAssistant((v) => !v)}
                  />
                )}
                {toolNames.length > 0 && (
                  <div className="ar-fsub">
                    <div className="ar-fsub-h">Tool Messages</div>
                    <div className="ar-fgrp-c">
                      {toolNames.map((name) => (
                        <FilterRow
                          key={name}
                          label={name}
                          count={counts.toolByName[name] ?? 0}
                          on={enabledTools.has(name)}
                          onToggle={() => toggleTool(name)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="ar-fgrp">
              <div className="ar-fgrp-h">Status</div>
              <div className="ar-fgrp-c">
                <FilterRow
                  label="All"
                  count={items.length}
                  on={statusFilter === "all"}
                  onToggle={() => setStatusFilter("all")}
                />
                <FilterRow
                  label="Passed"
                  count={items.length - counts.failed}
                  on={statusFilter === "passed"}
                  onToggle={() => setStatusFilter("passed")}
                />
                <FilterRow
                  label="Failed"
                  count={counts.failed}
                  on={statusFilter === "failed"}
                  onToggle={() => setStatusFilter("failed")}
                />
              </div>
            </div>
          </div>
        </section>
      </aside>
      <main
        className="ar-devtool-main"
        ref={scrollRef as React.RefObject<HTMLElement>}
      >
        <div className="ar-devtool-thread">
          <DevtoolTimeline
            items={visible}
            toolVariants={toolVariants}
            components={components}
            expansion={expansion}
          />
        </div>
      </main>
      <ScrollToBottom visible={!atBottom} onClick={scrollToBottom} />
    </div>
  );
}

function FilterRow({
  label,
  count,
  on,
  onToggle,
}: {
  label: string;
  count: number;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="ar-filt" onClick={onToggle} aria-pressed={on}>
      <span className={`ck${on ? " on" : ""}`}>{on ? "✓" : ""}</span>
      <span className="ar-filt-label">{label}</span>
      <span className="count">{count}</span>
    </button>
  );
}

function DevtoolTimeline({
  items,
  toolVariants,
  components,
  expansion,
}: {
  items: ChatItem[];
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  components: ConversationComponents;
  expansion: ExpansionDefaults;
}) {
  return (
    <>
      {items.map((item) =>
        renderChatItem(item, "devtool", toolVariants, components, expansion)
      )}
    </>
  );
}

/* --------------------------------------------------------------------- *
 * Inspector mode — 3-pane filter / event-table / raw-JSON inspector.
 *
 * A debugging view: less narrative, more raw event spelunking. Useful when
 * the chat or devtool view doesn't surface enough detail (timestamps, raw
 * payload, filtering by type).
 * --------------------------------------------------------------------- */

const TYPE_LABELS: Record<ConversationEvent["type"], { label: string; cls: string }> = {
  user_message: { label: "user", cls: "user" },
  assistant_message: { label: "assistant", cls: "asst" },
  thinking: { label: "thinking", cls: "thinking" },
  tool_call: { label: "tool_call", cls: "tool" },
  tool_result: { label: "tool_result", cls: "tool" },
  compaction: { label: "compaction", cls: "compaction" },
  system_message: { label: "system", cls: "sys" },
  error: { label: "error", cls: "err" },
  citation: { label: "citation", cls: "citation" },
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const mss = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${mss.slice(0, 2)}`;
}

function formatDur(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function previewOf(event: ConversationEvent): string {
  switch (event.type) {
    case "user_message":
    case "assistant_message":
    case "thinking":
    case "system_message":
      return event.content.replace(/\s+/g, " ").trim();
    case "tool_call":
      return `${event.toolName}(${truncJson(event.input)})`;
    case "tool_result":
      return event.isError
        ? `error · ${event.errorMessage ?? ""}`
        : truncJson(event.output);
    case "compaction":
      return `${event.compactedEventIds.length} events → "${event.summary.slice(0, 60)}…"`;
    case "error":
      return event.message;
    case "citation":
      return event.sourceTitle ?? event.sourceUrl ?? "";
  }
}

function truncJson(v: unknown, max = 80): string {
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function durationFor(event: ConversationEvent): number | undefined {
  if (event.type === "tool_result") return event.durationMs;
  if (event.type === "thinking") return event.durationMs;
  return undefined;
}

interface InspectorViewProps {
  events: ConversationEvent[];
  metadata?: ConversationViewProps["metadata"];
}

function InspectorView({ events, metadata }: InspectorViewProps) {
  const allTypes = useMemo(() => {
    const counts: Partial<Record<ConversationEvent["type"], number>> = {};
    for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
    return counts;
  }, [events]);

  const [enabledTypes, setEnabledTypes] = useState<Set<ConversationEvent["type"]>>(
    () => new Set(Object.keys(allTypes) as ConversationEvent["type"][])
  );
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.id ?? null);

  const visible = useMemo(
    () => events.filter((e) => enabledTypes.has(e.type)),
    [events, enabledTypes]
  );
  const selected = events.find((e) => e.id === selectedId) ?? null;

  const toggleType = (t: ConversationEvent["type"]) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  return (
    <div className="ar-dev-shell">
      <aside className="ar-dev-side">
        <section>
          <h5>Conversation</h5>
          <div className="ar-kv">
            {metadata?.title && (
              <div><span>title</span><b>{metadata.title}</b></div>
            )}
            {metadata?.model && (
              <div><span>model</span><b>{String(metadata.model)}</b></div>
            )}
            <div><span>events</span><b>{events.length}</b></div>
            {events[0] && (
              <div><span>started</span><b>{formatTime(events[0].timestamp)}</b></div>
            )}
          </div>
        </section>
        <section>
          <h5>Filters</h5>
          <div className="ar-filters">
            {(Object.keys(allTypes) as ConversationEvent["type"][]).map((t) => {
              const on = enabledTypes.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  className="ar-filt"
                  onClick={() => toggleType(t)}
                >
                  <span className={`ck${on ? " on" : ""}`}>{on ? "✓" : ""}</span>
                  <span>{TYPE_LABELS[t].label}</span>
                  <span className="count">{allTypes[t]}</span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <main className="ar-dev-events">
        <div className="ar-dev-events-head">
          <span>time</span>
          <span></span>
          <span>type</span>
          <span>preview</span>
          <span>dur</span>
        </div>
        {visible.map((e) => {
          const tl = TYPE_LABELS[e.type];
          const isErr =
            e.type === "error" ||
            e.status === "error" ||
            (e.type === "tool_result" && e.isError === true);
          return (
            <button
              key={e.id}
              type="button"
              className={[
                "ar-dev-event",
                selectedId === e.id ? "selected" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelectedId(e.id)}
            >
              <span className="ts">{formatTime(e.timestamp)}</span>
              <span>
                <span className={`ar-dot ${isErr ? "danger" : statusDotForType(e.type)}`} />
              </span>
              <span className={`typ ${isErr ? "err" : tl.cls}`}>{tl.label}</span>
              <span className="prev">{previewOf(e)}</span>
              <span className="dur">{formatDur(durationFor(e))}</span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div style={{ padding: 24, color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-12)" }}>
            No events match the active filters.
          </div>
        )}
      </main>

      <aside className="ar-dev-inspector">
        <section>
          <h5>Inspector</h5>
          {selected ? (
            <>
              <div className="ar-kv" style={{ marginBottom: 12 }}>
                <div><span>id</span><b>{selected.id}</b></div>
                <div><span>type</span><b>{selected.type}</b></div>
                <div><span>status</span><b>{selected.status}</b></div>
                <div><span>timestamp</span><b>{formatTime(selected.timestamp)}</b></div>
                {durationFor(selected) != null && (
                  <div><span>duration</span><b>{formatDur(durationFor(selected))}</b></div>
                )}
              </div>
              <JsonDisplay value={selected} defaultExpandDepth={2} />
            </>
          ) : (
            <div className="ar-meta">Select an event.</div>
          )}
        </section>
      </aside>
    </div>
  );
}

function statusDotForType(type: ConversationEvent["type"]): string {
  switch (type) {
    case "user_message": return "accent";
    case "assistant_message": return "accent";
    case "tool_call": return "muted";
    case "tool_result": return "success";
    case "thinking": return "muted";
    case "compaction": return "muted";
    case "error": return "danger";
    case "citation": return "muted";
    case "system_message": return "muted";
  }
}

/* --------------------------------------------------------------------- *
 * Public component
 * --------------------------------------------------------------------- */
export interface ExpansionDefaults {
  /** Override default expansion for ToolCallRequestDisplay cards. */
  toolRequest?: boolean;
  /** Override default expansion for ToolCallResultDisplay cards. */
  toolResult?: boolean;
  /** Whether the chevron toggle is shown on tool-request cards. Default true. */
  inputCollapsible?: boolean;
  /** Whether the chevron toggle is shown on tool-result cards. Default true. */
  outputCollapsible?: boolean;
}

export function ConversationView({
  events,
  mode = "chat",
  metadata,
  toolVariants,
  components,
  showSearch = false,
  toolRequestDefaultExpanded,
  toolResultDefaultExpanded,
  expandToolInputBtn = true,
  expandToolOutputBtn = true,
  onAllowToolCall,
  onDenyToolCall,
  className,
}: ConversationViewProps) {
  const expansion: ExpansionDefaults = {
    toolRequest: toolRequestDefaultExpanded,
    toolResult: toolResultDefaultExpanded,
    inputCollapsible: expandToolInputBtn,
    outputCollapsible: expandToolOutputBtn,
  };
  const items = useMemo(() => buildChatItems(events), [events]);
  const title = metadata?.title ?? "conversation";
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Merge consumer overrides on top of the built-in components. Consumers
  // that omit a key get the default — partial overrides are the common case.
  const C = useMemo<ConversationComponents>(
    () => ({ ...DEFAULT_COMPONENTS, ...components }),
    [components]
  );

  let shell: React.ReactNode;
  if (mode === "inspector") {
    shell = (
      <div className={["ar-frame", className].filter(Boolean).join(" ")}>
        <div className="ar-frame-bar">
          <span className="lite" /><span className="lite" /><span className="lite" />
          <span className="ar-frame-title">inspector · {title}</span>
        </div>
        <InspectorView events={events} metadata={metadata} />
      </div>
    );
  } else if (mode === "devtool") {
    shell = (
      <div className={["ar-frame", className].filter(Boolean).join(" ")}>
        <div className="ar-frame-bar">
          <span className="lite" /><span className="lite" /><span className="lite" />
          <span className="ar-frame-title">devtool · {title}</span>
        </div>
        <DevtoolView
          items={items}
          toolVariants={toolVariants}
          components={C}
          expansion={expansion}
          scrollRef={scrollContainerRef}
        />
      </div>
    );
  } else {
    // Chat mode (default).
    shell = (
      <div className={["ar-frame", className].filter(Boolean).join(" ")}>
        <div className="ar-frame-bar">
          <span className="lite" /><span className="lite" /><span className="lite" />
          <span className="ar-frame-title">chat · {title}</span>
        </div>
        <ChatView
          items={items}
          toolVariants={toolVariants}
          components={C}
          expansion={expansion}
          eventCount={events.length}
          scrollRef={scrollContainerRef}
        />
      </div>
    );
  }

  let composed: React.ReactNode = shell;
  if (showSearch) {
    composed = (
      <ConversationSearch events={events} scrollContainerRef={scrollContainerRef}>
        {composed}
      </ConversationSearch>
    );
  }
  if (onAllowToolCall || onDenyToolCall) {
    composed = (
      <ToolPermissionProvider onAllow={onAllowToolCall} onDeny={onDenyToolCall}>
        {composed}
      </ToolPermissionProvider>
    );
  }
  return composed;
}

function ChatView({
  items,
  toolVariants,
  components,
  expansion,
  eventCount,
  scrollRef,
}: {
  items: ChatItem[];
  toolVariants?: Record<string, ToolVariantComponent<unknown, unknown>>;
  components: ConversationComponents;
  expansion: ExpansionDefaults;
  eventCount: number;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const { atBottom, scrollToBottom } = useAutoScroll(scrollRef, eventCount);
  return (
    <div className="ar-chat-shell">
      <aside className="ar-chat-side">
        <button className="ic active" type="button" aria-label="threads">≡</button>
        <button className="ic" type="button" aria-label="search">⌕</button>
        <button className="ic" type="button" aria-label="settings">⚙</button>
      </aside>
      <main className="ar-chat-main" ref={scrollRef as React.RefObject<HTMLElement>}>
        <div className="ar-chat-thread">
          <ChatThread
            items={items}
            toolVariants={toolVariants}
            components={components}
            expansion={expansion}
          />
        </div>
      </main>
      <ScrollToBottom visible={!atBottom} onClick={scrollToBottom} />
    </div>
  );
}
