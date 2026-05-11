import { CodeDisplay } from "../../primitives/CodeDisplay";
import { ToolDisplay } from "../ToolDisplay";
import { ErrorInset } from "./ErrorInset";
import {
  CASE_INSENSITIVE_KEYS,
  CONTEXT_AFTER_KEYS,
  CONTEXT_BEFORE_KEYS,
  CONTEXT_LINES_KEYS,
  GLOB_KEYS,
  GREP_MATCHES_KEYS,
  MAX_RESULTS_KEYS,
  MULTILINE_KEYS,
  PATTERN_KEYS,
  SEARCH_PATH_KEYS,
  pickArray,
  pickBoolean,
  pickNumber,
  pickString,
} from "./fields";
import type { ToolVariantProps } from "./types";

interface GrepLine { lineNo: number; text: string; }
interface GrepFile { file: string; lines: GrepLine[]; }
type GrepInput = Record<string, unknown>;
type GrepOutput = Record<string, unknown>;

function summaryFor(
  pattern: string,
  searchPath: string | undefined,
  output: GrepOutput | undefined,
  mode: string,
  files: GrepFile[] | undefined
): string {
  const q = pattern;
  if (!output || mode === "request") {
    return q
      ? searchPath
        ? `"${q}" in ${searchPath}`
        : `"${q}"`
      : "grep";
  }
  const totalMatches =
    pickNumber(output, ["totalMatches", "total_matches"]) ??
    files?.reduce((s, f) => s + f.lines.length, 0) ??
    0;
  const totalFiles =
    pickNumber(output, ["totalFiles", "total_files"]) ?? files?.length ?? 0;
  return `"${q}" · ${totalMatches} match${totalMatches === 1 ? "" : "es"} in ${totalFiles} file${totalFiles === 1 ? "" : "s"}`;
}

export function GrepToolDisplay({
  event,
  mode = "merged",
  ...rest
}: ToolVariantProps<GrepInput, GrepOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  const pattern = pickString(input, PATTERN_KEYS) ?? "";
  const searchPath = pickString(input, SEARCH_PATH_KEYS);
  const caseInsensitive = pickBoolean(input, CASE_INSENSITIVE_KEYS);
  const multiline = pickBoolean(input, MULTILINE_KEYS);
  const glob = pickString(input, GLOB_KEYS);
  const maxResults = pickNumber(input, MAX_RESULTS_KEYS);
  const contextBefore = pickNumber(input, CONTEXT_BEFORE_KEYS);
  const contextAfter = pickNumber(input, CONTEXT_AFTER_KEYS);
  const contextLines = pickNumber(input, CONTEXT_LINES_KEYS);
  const before = contextBefore ?? contextLines;
  const after = contextAfter ?? contextLines;

  const matches = pickArray<GrepFile>(output, GREP_MATCHES_KEYS);
  const truncated = pickNumber(output, ["truncated", "more"]);

  const showOutput = mode === "merged";

  // Render a chip strip for any flags that are set. Path goes in the chips
  // too so the "in src/" context is visible alongside the other modifiers.
  const chips: React.ReactNode[] = [];
  if (searchPath) {
    chips.push(<ToolDisplay.Chip key="path" label="in" value={searchPath} />);
  }
  if (caseInsensitive === true) {
    chips.push(<ToolDisplay.Chip key="case" label="case-insensitive" />);
  }
  if (multiline === true) {
    chips.push(<ToolDisplay.Chip key="multiline" label="multiline" />);
  }
  if (glob) {
    chips.push(<ToolDisplay.Chip key="glob" label="glob" value={glob} />);
  }
  if (maxResults != null) {
    chips.push(<ToolDisplay.Chip key="max" label="max" value={maxResults} />);
  }
  if (before != null || after != null) {
    let value: string;
    if (before != null && after != null) {
      value = before === after ? `±${before}` : `−${before} / +${after}`;
    } else if (before != null) {
      value = `−${before}`;
    } else {
      value = `+${after}`;
    }
    chips.push(<ToolDisplay.Chip key="ctx" label="ctx" value={value} />);
  }

  let body: React.ReactNode;
  if (mode === "request") {
    body = chips.length > 0 ? <ToolDisplay.Chips>{chips}</ToolDisplay.Chips> : null;
  } else if (isError) {
    body = <ErrorInset title="Errored" detail={errorMessage} />;
  } else if (showOutput) {
    body = (
      <>
        {chips.length > 0 && <ToolDisplay.Chips>{chips}</ToolDisplay.Chips>}
        {matches !== undefined ? (
          matches.length === 0 ? (
            <div className="ar-meta">No matches.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {matches.map((f, i) => (
                <div key={`${f.file}-${i}`}>
                  <div className="ar-grep-file">
                    {f.file}{" "}
                    <span className="ar-meta">
                      · {f.lines.length} match{f.lines.length === 1 ? "" : "es"}
                    </span>
                  </div>
                  <CodeDisplay
                    value={f.lines.map((l) => l.text).join("\n")}
                    showLineNumbers={false}
                    copyable={false}
                    maxHeight={200}
                  />
                </div>
              ))}
              {truncated != null && truncated > 0 && (
                <div className="ar-more-row">
                  + {truncated} more file{truncated === 1 ? "" : "s"}
                </div>
              )}
            </div>
          )
        ) : null}
      </>
    );
  }

  return (
    <ToolDisplay
      name={name}
      status={status}
      durationMs={durationMs}
      summary={summaryFor(pattern, searchPath, output, mode, matches)}
      permission={event.permission}
      toolCallId={event.toolCallId}
      {...rest}
    >
      {body}
    </ToolDisplay>
  );
}
