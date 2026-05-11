import { useMemo, useState, Fragment } from "react";
import { diffLines } from "diff";

export type DiffView = "unified" | "split";

export interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  language?: string;
  filename?: string;
  view?: DiffView;
  showLineNumbers?: boolean;
  contextLines?: number;
  /** Hide unchanged regions beyond `contextLines` GitHub-style. */
  collapseUnchanged?: boolean;
  maxHeight?: number;
  /** Wrap the whole component in collapse / expand. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

type LineKind = "ctx" | "add" | "del";
interface DiffLine {
  kind: LineKind;
  text: string;
  oldNo?: number;
  newNo?: number;
}
interface CollapsedGap {
  kind: "gap";
  hidden: number;
  /** Line numbers at the boundaries — for the click-to-expand label. */
  oldRange: [number, number];
  newRange: [number, number];
}

type Row = DiffLine | CollapsedGap;

function buildLines(oldValue: string, newValue: string): DiffLine[] {
  const parts = diffLines(oldValue, newValue);
  const out: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (const part of parts) {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) {
      if (part.added) {
        out.push({ kind: "add", text, newNo });
        newNo++;
      } else if (part.removed) {
        out.push({ kind: "del", text, oldNo });
        oldNo++;
      } else {
        out.push({ kind: "ctx", text, oldNo, newNo });
        oldNo++;
        newNo++;
      }
    }
  }
  return out;
}

function collapse(lines: DiffLine[], contextLines: number): Row[] {
  const rows: Row[] = [];
  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];
    if (line.kind !== "ctx") {
      rows.push(line);
      i++;
      continue;
    }
    // Walk the run of ctx lines.
    const start = i;
    while (i < n && lines[i].kind === "ctx") i++;
    const end = i; // exclusive
    const runLength = end - start;

    const isFirst = start === 0;
    const isLast = end === n;

    // Lead — keep `contextLines` after the previous change (skip if at file start).
    const lead = isFirst ? 0 : Math.min(contextLines, runLength);
    // Trail — keep `contextLines` before the next change (skip if at file end).
    const trail = isLast ? 0 : Math.min(contextLines, runLength - lead);

    const hidden = runLength - lead - trail;

    for (let k = 0; k < lead; k++) rows.push(lines[start + k]);
    if (hidden > 0) {
      const hiddenStart = lines[start + lead];
      const hiddenEnd = lines[start + lead + hidden - 1];
      rows.push({
        kind: "gap",
        hidden,
        oldRange: [hiddenStart.oldNo!, hiddenEnd.oldNo!],
        newRange: [hiddenStart.newNo!, hiddenEnd.newNo!],
      });
    }
    for (let k = 0; k < trail; k++) rows.push(lines[start + lead + hidden + k]);
  }
  return rows;
}

function countAddDel(lines: DiffLine[]): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const l of lines) {
    if (l.kind === "add") add++;
    else if (l.kind === "del") del++;
  }
  return { add, del };
}

export function DiffViewer({
  oldValue,
  newValue,
  language: _language,
  filename,
  view = "unified",
  showLineNumbers = true,
  contextLines = 3,
  collapseUnchanged = true,
  maxHeight = 500,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: DiffViewerProps) {
  void _language;
  const lines = useMemo(() => buildLines(oldValue, newValue), [oldValue, newValue]);
  const stats = useMemo(() => countAddDel(lines), [lines]);
  const [whole, setWhole] = useState(collapsible && defaultCollapsed);

  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(new Set());

  const rows = useMemo(() => {
    if (!collapseUnchanged) return lines as Row[];
    const collapsed = collapse(lines, contextLines);
    if (expandedGaps.size === 0) return collapsed;
    // Replace expanded gaps with the actual lines.
    const out: Row[] = [];
    let gapCounter = 0;
    let cursor = 0;
    for (const row of collapsed) {
      if (row.kind === "gap") {
        if (expandedGaps.has(gapCounter)) {
          // find the original lines that match the gap range
          const [oldStart, oldEnd] = row.oldRange;
          for (let i = cursor; i < lines.length; i++) {
            const ln = lines[i];
            if (ln.kind === "ctx" && ln.oldNo! >= oldStart && ln.oldNo! <= oldEnd) {
              out.push(ln);
            }
            if (ln.oldNo === oldEnd) {
              cursor = i + 1;
              break;
            }
          }
        } else {
          out.push(row);
        }
        gapCounter++;
      } else {
        out.push(row);
        cursor++;
      }
    }
    return out;
  }, [lines, collapseUnchanged, contextLines, expandedGaps]);

  const expandGap = (idx: number) => {
    setExpandedGaps((s) => {
      const next = new Set(s);
      next.add(idx);
      return next;
    });
  };

  const head = (
    <div className="ar-diff-head">
      {filename && <span className="file">{filename}</span>}
      <span className="badge">{view}</span>
      <span className="stats">
        <span className="add-c">+{stats.add}</span>
        <span className="del-c">−{stats.del}</span>
      </span>
      {collapsible && (
        <button
          type="button"
          className="btn ghost tiny"
          onClick={() => setWhole((w) => !w)}
        >
          {whole ? "Expand" : "Collapse"}
        </button>
      )}
    </div>
  );

  if (whole) {
    return (
      <div className={["ar-diff", className].filter(Boolean).join(" ")}>
        {head}
      </div>
    );
  }

  if (view === "split") {
    return (
      <div className={["ar-diff", "split", className].filter(Boolean).join(" ")}>
        {head}
        <div className="ar-diff-body" style={{ maxHeight }}>
          <SplitPane rows={rows} side="left" showLineNumbers={showLineNumbers} onExpandGap={expandGap} />
          <SplitPane rows={rows} side="right" showLineNumbers={showLineNumbers} onExpandGap={expandGap} />
        </div>
      </div>
    );
  }

  // Unified view
  let gapIdx = 0;
  return (
    <div className={["ar-diff", className].filter(Boolean).join(" ")}>
      {head}
      <div className="ar-diff-body" style={{ maxHeight }}>
        {rows.map((row, i) => {
          if (row.kind === "gap") {
            const myIdx = gapIdx++;
            return (
              <button
                key={`gap-${i}`}
                type="button"
                className="ar-dl-collapsed"
                onClick={() => expandGap(myIdx)}
              >
                … {row.hidden} unchanged line{row.hidden === 1 ? "" : "s"}
              </button>
            );
          }
          return (
            <DiffRow
              key={i}
              line={row}
              showLineNumbers={showLineNumbers}
            />
          );
        })}
      </div>
    </div>
  );
}

function DiffRow({ line, showLineNumbers }: { line: DiffLine; showLineNumbers: boolean }) {
  const sig = line.kind === "add" ? "+" : line.kind === "del" ? "−" : " ";
  return (
    <div className={`ar-dl ${line.kind}`}>
      {showLineNumbers && (
        <Fragment>
          <span className="g">{line.kind === "add" ? "" : line.oldNo ?? ""}</span>
          <span className="g">{line.kind === "del" ? "" : line.newNo ?? ""}</span>
        </Fragment>
      )}
      <span className="sig">{sig}</span>
      <span className="src">{line.text || " "}</span>
    </div>
  );
}

function SplitPane({
  rows,
  side,
  showLineNumbers,
  onExpandGap,
}: {
  rows: Row[];
  side: "left" | "right";
  showLineNumbers: boolean;
  onExpandGap: (idx: number) => void;
}) {
  let gapIdx = 0;
  return (
    <div className="ar-diff-pane">
      {rows.map((row, i) => {
        if (row.kind === "gap") {
          const myIdx = gapIdx++;
          return (
            <button
              key={`gap-${i}`}
              type="button"
              className="ar-dl-collapsed"
              onClick={() => onExpandGap(myIdx)}
            >
              … {row.hidden} unchanged
            </button>
          );
        }
        // For split: show only lines that exist on this side.
        const showLeft = row.kind !== "add";
        const showRight = row.kind !== "del";
        if (side === "left" && !showLeft) {
          return <div key={i} className="ar-dl"><span className="src"> </span></div>;
        }
        if (side === "right" && !showRight) {
          return <div key={i} className="ar-dl"><span className="src"> </span></div>;
        }
        return (
          <div key={i} className={`ar-dl ${row.kind}`}>
            {showLineNumbers && (
              <span className="g">
                {side === "left" ? row.oldNo ?? "" : row.newNo ?? ""}
              </span>
            )}
            <span className="sig">
              {row.kind === "add" ? "+" : row.kind === "del" ? "−" : " "}
            </span>
            <span className="src">{row.text || " "}</span>
          </div>
        );
      })}
    </div>
  );
}
