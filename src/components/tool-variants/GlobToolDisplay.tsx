import { ToolDisplay } from "../ToolDisplay";
import { ErrorInset } from "./ErrorInset";
import {
  CASE_INSENSITIVE_KEYS,
  FILE_TYPE_KEYS,
  GLOB_FILES_KEYS,
  MAX_RESULTS_KEYS,
  PATTERN_KEYS,
  SEARCH_PATH_KEYS,
  pickArray,
  pickBoolean,
  pickNumber,
  pickString,
} from "./fields";
import type { ToolVariantProps } from "./types";

interface GlobFile { path: string; sizeBytes?: number; }
type GlobInput = Record<string, unknown>;
type GlobOutput = Record<string, unknown>;

function formatBytes(n?: number): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function GlobToolDisplay({
  event,
  mode = "merged",
  ...rest
}: ToolVariantProps<GlobInput, GlobOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  const pattern =
    pickString(input, PATTERN_KEYS) ??
    pickString(input, ["glob"]) ??
    "";
  const searchPath = pickString(input, SEARCH_PATH_KEYS);
  const fileType = pickString(input, FILE_TYPE_KEYS);
  const caseInsensitive = pickBoolean(input, CASE_INSENSITIVE_KEYS);
  const maxResults = pickNumber(input, MAX_RESULTS_KEYS);

  const files = pickArray<GlobFile>(output, GLOB_FILES_KEYS);
  const truncated = pickNumber(output, ["truncated", "more"]);

  const summary = (() => {
    if (!output || mode === "request") return pattern;
    const total = (files?.length ?? 0) + (truncated ?? 0);
    return `${pattern} · ${total} file${total === 1 ? "" : "s"}`;
  })();

  const chips: React.ReactNode[] = [];
  if (searchPath) chips.push(<ToolDisplay.Chip key="in" label="in" value={searchPath} />);
  if (fileType) chips.push(<ToolDisplay.Chip key="type" label="type" value={fileType} />);
  if (caseInsensitive === true)
    chips.push(<ToolDisplay.Chip key="case" label="case-insensitive" />);
  if (maxResults != null)
    chips.push(<ToolDisplay.Chip key="max" label="max" value={maxResults} />);

  let body: React.ReactNode;
  if (mode === "request") {
    body = chips.length > 0 ? <ToolDisplay.Chips>{chips}</ToolDisplay.Chips> : null;
  } else if (isError) {
    body = <ErrorInset title="Errored" detail={errorMessage} />;
  } else {
    body = (
      <>
        {chips.length > 0 && <ToolDisplay.Chips>{chips}</ToolDisplay.Chips>}
        {files !== undefined ? (
          files.length === 0 ? (
            <div className="ar-meta">No files.</div>
          ) : (
            <div className="ar-glob-list">
              {files.map((f) => (
                <div key={f.path}>
                  <span>{f.path}</span>
                  {f.sizeBytes != null && (
                    <span className="meta">{formatBytes(f.sizeBytes)}</span>
                  )}
                </div>
              ))}
              {truncated != null && truncated > 0 && (
                <div className="ar-more-row" style={{ gridColumn: "1 / -1" }}>
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
      summary={summary}
      permission={event.permission}
      toolCallId={event.toolCallId}
      {...rest}
    >
      {body}
    </ToolDisplay>
  );
}
