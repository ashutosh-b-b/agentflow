import { ToolDisplay } from "../ToolDisplay";
import { ErrorInset } from "./ErrorInset";
import {
  FRESHNESS_KEYS,
  LOCALE_KEYS,
  MAX_RESULTS_KEYS,
  QUERY_KEYS,
  SAFE_MODE_KEYS,
  SEARCH_RESULTS_KEYS,
  pickArray,
  pickBoolean,
  pickNumber,
  pickString,
} from "./fields";
import type { ToolVariantProps } from "./types";

interface SearchResult { title: string; url: string; snippet?: string; }
type SearchInput = Record<string, unknown>;
type SearchOutput = Record<string, unknown>;

export function WebSearchToolDisplay({
  event,
  mode = "merged",
  ...rest
}: ToolVariantProps<SearchInput, SearchOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  const query = pickString(input, QUERY_KEYS) ?? "";
  const freshness = pickString(input, FRESHNESS_KEYS);
  const locale = pickString(input, LOCALE_KEYS);
  const safeMode = pickBoolean(input, SAFE_MODE_KEYS);
  const maxResults = pickNumber(input, MAX_RESULTS_KEYS);

  const results = pickArray<SearchResult>(output, SEARCH_RESULTS_KEYS);

  const summary = (() => {
    const q = query ? `"${query}"` : "";
    if (!output || mode === "request") return q;
    const n = results?.length ?? 0;
    return `${q} · ${n} result${n === 1 ? "" : "s"}`;
  })();

  const chips: React.ReactNode[] = [];
  if (freshness) chips.push(<ToolDisplay.Chip key="fresh" label="freshness" value={freshness} />);
  if (locale) chips.push(<ToolDisplay.Chip key="locale" label="locale" value={locale} />);
  if (safeMode === true) chips.push(<ToolDisplay.Chip key="safe" label="safe-mode" />);
  if (maxResults != null) chips.push(<ToolDisplay.Chip key="max" label="max" value={maxResults} />);

  let body: React.ReactNode;
  if (mode === "request") {
    body = chips.length > 0 ? <ToolDisplay.Chips>{chips}</ToolDisplay.Chips> : null;
  } else if (isError) {
    body = <ErrorInset title="Errored" detail={errorMessage} />;
  } else {
    body = (
      <>
        {chips.length > 0 && <ToolDisplay.Chips>{chips}</ToolDisplay.Chips>}
        {results !== undefined ? (
          results.length === 0 ? (
            <div className="ar-meta">No results.</div>
          ) : (
            <div className="ar-srch-results">
              {results.map((r, i) => (
                <div key={`${r.url}-${i}`} className="ar-srch-result">
                  <a
                    className="title"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {r.title}
                  </a>
                  <div className="url">{r.url}</div>
                  {r.snippet && <div className="snippet">{r.snippet}</div>}
                </div>
              ))}
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
      costUsd={event.costUsd}
      tokens={event.tokens}
      summary={summary}
      permission={event.permission}
      toolCallId={event.toolCallId}
      {...rest}
    >
      {body}
    </ToolDisplay>
  );
}
