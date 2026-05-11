import { useCallback, useState } from "react";

export interface JsonDisplayProps {
  value: unknown;
  /**
   * Auto-expand nodes up to this depth (0 = root only). Beyond this depth
   * nodes start collapsed; the user can expand them on click.
   */
  defaultExpandDepth?: number;
  /**
   * Highlight node values whose keys / primitive values contain this term
   * (case-insensitive). Parents of matches auto-expand.
   */
  searchTerm?: string;
  /** Override the default clipboard handler; receives the JSON path. */
  onCopyPath?: (path: string) => void;
  /** Bound the rendered area to N pixels — content scrolls inside. */
  maxHeight?: number;
  /** Maximum string length rendered inline before truncation with "…". */
  maxStringPreview?: number;
  className?: string;
}

/**
 * Real expandable JSON tree. Drop-in replacement for `<pre>{JSON.stringify(v, null, 2)}</pre>`
 * with collapse-by-depth, copy-by-path, and search-aware auto-expansion.
 */
export function JsonDisplay({
  value,
  defaultExpandDepth = 1,
  searchTerm = "",
  onCopyPath,
  maxHeight,
  maxStringPreview = 200,
  className,
}: JsonDisplayProps) {
  const handleCopyPath = useCallback(
    (path: string) => {
      if (onCopyPath) {
        onCopyPath(path);
        return;
      }
      navigator.clipboard?.writeText(path).catch(() => {});
    },
    [onCopyPath]
  );

  const trimmedTerm = searchTerm.trim();
  const style: React.CSSProperties | undefined =
    maxHeight != null ? { maxHeight, overflow: "auto" } : undefined;

  return (
    <div
      className={["ar-jsd", className].filter(Boolean).join(" ")}
      style={style}
    >
      <JsonNode
        value={value}
        path="$"
        depth={0}
        defaultExpandDepth={defaultExpandDepth}
        searchTerm={trimmedTerm}
        maxStringPreview={maxStringPreview}
        onCopyPath={handleCopyPath}
        isRoot
      />
    </div>
  );
}

/* --------------------------------------------------------------------- */

interface NodeProps {
  value: unknown;
  /** Path label shown when copying. We use bracket notation throughout. */
  path: string;
  depth: number;
  defaultExpandDepth: number;
  searchTerm: string;
  maxStringPreview: number;
  onCopyPath: (path: string) => void;
  /** When true, suppress the leading key/index — rendered at root. */
  isRoot?: boolean;
  /** Optional label rendered as the key column. */
  label?: string;
  /** Whether this label is an object key (string) or array index (number). */
  labelKind?: "key" | "index";
}

function JsonNode({
  value,
  path,
  depth,
  defaultExpandDepth,
  searchTerm,
  maxStringPreview,
  onCopyPath,
  isRoot,
  label,
  labelKind,
}: NodeProps) {
  const isContainer = isPlainContainer(value);
  const childMatches = isContainer && searchTerm.length > 0
    ? containsMatch(value, searchTerm)
    : false;

  const initialExpanded = depth < defaultExpandDepth || childMatches;
  const [internalExpanded, setExpanded] = useState(initialExpanded);
  // If a search term lights up later, auto-expand to reveal the match without
  // overwriting any user-collapse from a prior search.
  const expanded = childMatches ? true : internalExpanded;

  const labelEl = label != null ? (
    <button
      type="button"
      className={`ar-jsd-label ar-jsd-${labelKind ?? "key"}`}
      onClick={() => onCopyPath(path)}
      title={`Copy path: ${path}`}
    >
      {labelKind === "index" ? (
        <span>{label}</span>
      ) : (
        <Highlighted text={`"${label}"`} term={searchTerm} />
      )}
      <span className="ar-jsd-colon">:</span>
    </button>
  ) : null;

  if (!isContainer) {
    return (
      <div className="ar-jsd-row">
        {labelEl}
        <PrimitiveValue
          value={value}
          searchTerm={searchTerm}
          maxStringPreview={maxStringPreview}
        />
      </div>
    );
  }

  // Container — Array or plain Object.
  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const sizeLabel = isArray
    ? `Array · ${entries.length}`
    : `Object · ${entries.length}`;
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";

  return (
    <div className={`ar-jsd-node${expanded ? " open" : ""}`}>
      <div className="ar-jsd-row">
        <button
          type="button"
          className="ar-jsd-chev"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        {labelEl}
        <span className="ar-jsd-meta">
          {open}
          {!expanded && (
            <>
              {entries.length === 0 ? "" : "…"}
              {close}
              <span className="ar-jsd-size"> {sizeLabel}</span>
            </>
          )}
        </span>
        {isRoot && expanded && entries.length > 0 && (
          <span className="ar-jsd-size">{sizeLabel}</span>
        )}
      </div>
      {expanded && (
        <ul className="ar-jsd-children">
          {entries.map(([k, v]) => {
            const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
            return (
              <li key={k}>
                <JsonNode
                  value={v}
                  path={childPath}
                  depth={depth + 1}
                  defaultExpandDepth={defaultExpandDepth}
                  searchTerm={searchTerm}
                  maxStringPreview={maxStringPreview}
                  onCopyPath={onCopyPath}
                  label={k}
                  labelKind={isArray ? "index" : "key"}
                />
              </li>
            );
          })}
        </ul>
      )}
      {expanded && (
        <div className="ar-jsd-row">
          <span className="ar-jsd-meta">{close}</span>
        </div>
      )}
    </div>
  );
}

function PrimitiveValue({
  value,
  searchTerm,
  maxStringPreview,
}: {
  value: unknown;
  searchTerm: string;
  maxStringPreview: number;
}) {
  if (value === null) {
    return <span className="ar-jsd-null">null</span>;
  }
  if (value === undefined) {
    return <span className="ar-jsd-null">undefined</span>;
  }
  if (typeof value === "boolean") {
    return <span className="ar-jsd-bool">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return (
      <span className="ar-jsd-number">
        <Highlighted text={String(value)} term={searchTerm} />
      </span>
    );
  }
  if (typeof value === "string") {
    const display =
      value.length > maxStringPreview
        ? `${value.slice(0, maxStringPreview - 1)}…`
        : value;
    return (
      <span className="ar-jsd-string">
        "<Highlighted text={display} term={searchTerm} />"
        {value.length > maxStringPreview && (
          <span className="ar-jsd-size"> ({value.length} chars)</span>
        )}
      </span>
    );
  }
  // Fallback — bigint, symbol, function, etc.
  return <span className="ar-jsd-other">{String(value)}</span>;
}

function Highlighted({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ar-jsd-mark">{text.slice(idx, idx + term.length)}</mark>
      <Highlighted text={text.slice(idx + term.length)} term={term} />
    </>
  );
}

/* --------------------------------------------------------------------- */

function isPlainContainer(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return true;
  if (typeof value !== "object") return false;
  // Treat Map/Set/Date/etc. as primitives — we don't have a meaningful tree
  // for them. Fall through to PrimitiveValue.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function containsMatch(value: unknown, term: string): boolean {
  const t = term.toLowerCase();
  if (value === null) return "null".includes(t);
  if (value === undefined) return "undefined".includes(t);
  if (typeof value === "boolean") return String(value).includes(t);
  if (typeof value === "number") return String(value).includes(t);
  if (typeof value === "string") return value.toLowerCase().includes(t);
  if (Array.isArray(value)) return value.some((v) => containsMatch(v, term));
  if (isPlainContainer(value)) {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => k.toLowerCase().includes(t) || containsMatch(v, term)
    );
  }
  return false;
}
