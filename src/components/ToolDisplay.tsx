import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ToolPermissionState, ToolStatus } from "../types/events";
import { useToolPermissionHandlers } from "./permission/ToolPermissionContext";

export interface ToolDisplayProps {
  name: string;
  status: ToolStatus;
  durationMs?: number;
  /** One-line summary in the collapsed header. Slot override: <ToolDisplay.Summary>. */
  summary?: ReactNode;
  /** Slot override: <ToolDisplay.Header>. Replaces the entire default header. */
  header?: ReactNode;
  /** Uncontrolled initial state. */
  defaultExpanded?: boolean;
  /** Controlled expansion. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Body grows to this height max — content scrolls inside. */
  bodyMaxHeight?: number;
  /**
   * Permission state for the underlying tool call. When `'pending'`, renders
   * a badge in the header — and Allow / Deny action buttons if the surrounding
   * `<ToolPermissionProvider>` supplied handlers.
   */
  permission?: ToolPermissionState;
  /** Required for permission actions to fire — passed back to the handlers. */
  toolCallId?: string;
  className?: string;
  children?: ReactNode;
}

interface ToolDisplayContext {
  expanded: boolean;
  toggle: () => void;
  status: ToolStatus;
}

const Ctx = createContext<ToolDisplayContext | null>(null);

function useToolCtx(): ToolDisplayContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToolDisplay slot used outside <ToolDisplay>");
  return ctx;
}

/** Status → dot class. */
function statusDotClass(status: ToolStatus): string {
  switch (status) {
    case "complete": return "success";
    case "error": return "danger";
    case "running": return "accent pulse";
    case "idle": default: return "muted";
  }
}

function formatDuration(ms?: number, status?: ToolStatus): string | null {
  if (status === "running") return "running…";
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* --------------------------------------------------------------------- *
 * Slot subcomponents — markers that the base looks up in `children`.
 * They render `null` themselves; the base reads their props/children and
 * places them in the right structural slot.
 * --------------------------------------------------------------------- */
type Slot<P> = ((props: P) => null) & { displayName: string };

function makeSlot<P>(name: string): Slot<P> {
  const fn = ((_props: P) => null) as Slot<P>;
  fn.displayName = name;
  return fn;
}

const HeaderSlot = makeSlot<{ children?: ReactNode }>("ToolDisplay.Header");
const SummarySlot = makeSlot<{ children?: ReactNode }>("ToolDisplay.Summary");
const BodySlot = makeSlot<{ children?: ReactNode }>("ToolDisplay.Body");

interface SectionProps {
  label?: ReactNode;
  /** Tint the label red — used for stderr / error sections. */
  danger?: boolean;
  children?: ReactNode;
}

/* --------- chip primitives ---------
 * Available as <ToolDisplay.Chip /> and <ToolDisplay.Chips>...</ToolDisplay.Chips>
 * for variants that need to surface input flags (case-insensitive, max-results,
 * context size, etc.) without a full Section.
 */

interface ChipProps {
  /** The flag's name (e.g. "case-insensitive"). */
  label: ReactNode;
  /** Optional value for `label: value` chips (e.g. "glob: *.ts"). */
  value?: ReactNode;
  /** Visual treatment: 'neutral' (default), 'accent', 'success', 'danger'. */
  tone?: "neutral" | "accent" | "success" | "danger";
}

/** A single flag chip. Renders inside a <ToolDisplay.Chips> strip. */
export function ToolChip({ label, value, tone = "neutral" }: ChipProps) {
  return (
    <span className={`ar-tool-chip tone-${tone}`}>
      <span className="label">{label}</span>
      {value != null && <span className="value">{value}</span>}
    </span>
  );
}

/** A horizontal strip of chips. Use for input flag indicators in a variant
 *  body. */
export function ToolChips({ children }: { children?: ReactNode }) {
  return <div className="ar-tool-chips">{children}</div>;
}

/* --------- ExitInfo primitive ---------
 * The "shell-shaped tool failed" treatment, extracted from BashToolDisplay.
 * Renders an exit code badge + (optional) stderr buffer. Reusable by any
 * variant that wraps a subprocess.
 */

interface ExitInfoProps {
  /** The numeric exit code. Renders as a `exit N` badge. */
  exitCode: number;
  /** Optional stderr buffer — shown in a danger-tinted code block. */
  stderr?: string;
  /** Optional human label ("rg", "kubectl", etc.) shown in the header. */
  command?: string;
}

/** Exit-code + stderr inset. Use for any tool that wraps a subprocess. */
export function ToolExitInfo({ exitCode, stderr, command }: ExitInfoProps) {
  return (
    <div className="ar-tool-exitinfo">
      <div className="ar-tool-exitinfo-head">
        {command && <span className="cmd">{command}</span>}
        <span className="exit">exit {exitCode}</span>
      </div>
      {stderr && <pre className="ar-tool-exitinfo-stderr">{stderr}</pre>}
    </div>
  );
}

/** A labeled section inside a tool body — composed by variants. */
export function ToolSection({ label, danger, children }: SectionProps) {
  return (
    <div className="ar-tool-section">
      {label != null && (
        <div className={`ar-tool-label${danger ? " danger" : ""}`}>{label}</div>
      )}
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Helpers to find slot children
 * --------------------------------------------------------------------- */
function findSlot(
  children: ReactNode,
  slot: { displayName: string }
): ReactElement<{ children?: ReactNode }> | undefined {
  let found: ReactElement<{ children?: ReactNode }> | undefined;
  Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type as { displayName?: string })?.displayName === slot.displayName) {
      found = child as ReactElement<{ children?: ReactNode }>;
    }
  });
  return found;
}

function nonSlotChildren(children: ReactNode): ReactNode[] {
  const slotNames = new Set([
    HeaderSlot.displayName,
    SummarySlot.displayName,
    BodySlot.displayName,
  ]);
  const out: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (
      isValidElement(child) &&
      slotNames.has((child.type as { displayName?: string })?.displayName ?? "")
    ) {
      return;
    }
    out.push(child);
  });
  return out;
}

/* --------------------------------------------------------------------- *
 * The component
 * --------------------------------------------------------------------- */

function ToolDisplayImpl(props: ToolDisplayProps) {
  const {
    name,
    status,
    durationMs,
    summary,
    header,
    defaultExpanded,
    expanded: expandedProp,
    onExpandedChange,
    bodyMaxHeight = 500,
    permission,
    toolCallId,
    className,
    children,
  } = props;
  const { onAllow, onDeny } = useToolPermissionHandlers();

  // Errors and pending-permission calls auto-expand by default — the user
  // can't approve what they can't see, and an error needs to be visible
  // without a click.
  const initial =
    defaultExpanded !== undefined
      ? defaultExpanded
      : status === "error" || permission === "pending";

  const [internalExpanded, setInternalExpanded] = useState<boolean>(initial);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : internalExpanded;

  // Sync internal state when the consumer flips `defaultExpanded` (e.g. a
  // global "collapse all results" toggle). Manual click-to-toggle is
  // unaffected because parent re-renders that don't change the prop don't
  // re-fire this effect.
  useEffect(() => {
    if (defaultExpanded !== undefined) setInternalExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const toggle = useCallback(() => {
    const next = !expanded;
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  }, [expanded, isControlled, onExpandedChange]);

  // Resolve slots
  const headerSlot = findSlot(children, HeaderSlot);
  const summarySlot = findSlot(children, SummarySlot);
  const bodySlot = findSlot(children, BodySlot);
  const looseChildren = nonSlotChildren(children);

  const summaryNode = summarySlot?.props.children ?? summary;
  const bodyNode = bodySlot?.props.children ?? (looseChildren.length > 0 ? looseChildren : null);

  const durationLabel = formatDuration(durationMs, status);
  const isError = status === "error";

  const showPermissionActions =
    permission === "pending" &&
    toolCallId != null &&
    (typeof onAllow === "function" || typeof onDeny === "function");

  const defaultHeader = (
    <div
      className={[
        "ar-tool-head",
        isError ? "error" : "",
        permission === "pending" ? "permission-pending" : "",
      ].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      aria-expanded={expanded}
    >
      <span className={`ar-dot ${statusDotClass(status)}`} aria-hidden />
      <span className="tname">{name}</span>
      {summaryNode != null && <span className="summary">{summaryNode}</span>}
      {permission && permission !== "allowed" && (
        <span className={`ar-tool-perm-badge perm-${permission}`}>
          {permission === "pending" ? "needs approval" : "denied"}
        </span>
      )}
      {durationLabel && <span className="meta">{durationLabel}</span>}
      {showPermissionActions && (
        <span className="ar-tool-perm-actions" onClick={(e) => e.stopPropagation()}>
          {typeof onDeny === "function" && (
            <button
              type="button"
              className="ar-tool-perm-deny"
              onClick={() => onDeny(toolCallId!)}
            >
              Deny
            </button>
          )}
          {typeof onAllow === "function" && (
            <button
              type="button"
              className="ar-tool-perm-allow"
              onClick={() => onAllow(toolCallId!)}
            >
              Allow
            </button>
          )}
        </span>
      )}
      <span className="chev" aria-hidden>›</span>
    </div>
  );

  return (
    <Ctx.Provider value={{ expanded, toggle, status }}>
      <div
        className={[
          "ar-tool",
          expanded ? "open" : "",
          isError ? "error" : "",
          className,
        ].filter(Boolean).join(" ")}
      >
        {header ?? headerSlot?.props.children ?? defaultHeader}
        {expanded && bodyNode != null && (
          <div className="ar-tool-body" style={{ maxHeight: bodyMaxHeight }}>
            {bodyNode}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

ToolDisplayImpl.Header = HeaderSlot;
ToolDisplayImpl.Summary = SummarySlot;
ToolDisplayImpl.Body = BodySlot;
ToolDisplayImpl.Section = ToolSection;
ToolDisplayImpl.Chip = ToolChip;
ToolDisplayImpl.Chips = ToolChips;
ToolDisplayImpl.ExitInfo = ToolExitInfo;

export const ToolDisplay = ToolDisplayImpl;
export { useToolCtx };
