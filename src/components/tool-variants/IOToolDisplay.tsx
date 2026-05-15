import { CodeDisplay } from "../../primitives/CodeDisplay";
import { DiffViewer } from "../../primitives/DiffViewer";
import { ImageDisplay } from "../../primitives/ImageDisplay";
import { languageForPath } from "../../primitives/highlight";
import { ToolDisplay } from "../ToolDisplay";
import { ErrorInset } from "./ErrorInset";
import {
  CONTENT_KEYS,
  NEW_STR_KEYS,
  OLD_STR_KEYS,
  PATH_KEYS,
  pickAny,
  pickNumber,
  pickString,
} from "./fields";
import type { ToolVariantProps } from "./types";

/**
 * read_file / write_file / str_replace / show_image.
 *
 * Accepts canonical fields and common synonyms (path | filepath | file_path |
 * file | src | filename, content | text | body | code | data, etc.). See
 * `docs/canonical-tool-shapes.md` for the full alias tables.
 */
type IOInput = Record<string, unknown>;
type IOOutput =
  | string
  | { content?: string; text?: string; body?: string; bytes_written?: number; replacements?: number };

/* `languageForPath` lives in `primitives/highlight.ts` next to
 * `registerLanguage` so consumer-registered extensions flow into the variant
 * automatically. */

function summaryFor(name: string, path: string, replacements?: number): string {
  if (name === "str_replace" && replacements != null) {
    return `${path} · ${replacements} replacement${replacements === 1 ? "" : "s"}`;
  }
  if (path) return path;
  return name;
}

/** When the path is the only meaningful input field, the header summary
 *  already covers it — skip the redundant Input section. */
function inputCoveredByHeader(input: IOInput, knownKeys: readonly string[]): boolean {
  const keys = Object.keys(input).filter(
    (k) => (input as Record<string, unknown>)[k] != null
  );
  if (keys.length === 0) return true;
  return keys.every((k) => (knownKeys as readonly string[]).includes(k));
}

export function IOToolDisplay({
  event,
  mode = "merged",
  inputCollapsible = true,
  outputCollapsible = true,
  ...rest
}: ToolVariantProps<IOInput, IOOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  // Canonical reads
  const path = pickString(input, PATH_KEYS) ?? "";
  const writeContent = pickString(input, CONTENT_KEYS);
  const oldStr = pickString(input, OLD_STR_KEYS);
  const newStr = pickString(input, NEW_STR_KEYS);
  const lang = languageForPath(path);

  const replacements =
    typeof output === "object" && output !== null
      ? pickNumber(output, ["replacements"])
      : undefined;
  const outputContent: string =
    typeof output === "string"
      ? output
      : pickString(output, ["content", "text", "body", "data"]) ?? "";

  const showInput = mode === "request" || mode === "merged";
  const showOutput = mode === "merged";

  const requestSection = (() => {
    if (!showInput) return null;
    if (name === "str_replace" && oldStr != null && newStr != null) {
      // The request *is* the diff (old → new).
      return (
        <ToolDisplay.Section label={path || "diff"}>
          <DiffViewer
            oldValue={oldStr}
            newValue={newStr}
            filename={path || undefined}
            language={lang}
            view="unified"
            collapsible={inputCollapsible}
          />
        </ToolDisplay.Section>
      );
    }
    if (name === "write_file" && writeContent != null) {
      return (
        <ToolDisplay.Section label={`Wrote ${path || "file"}`}>
          <CodeDisplay
            value={writeContent}
            language={lang}
            filename={path || undefined}
            collapsible={inputCollapsible}
            collapsedHeight={200}
          />
        </ToolDisplay.Section>
      );
    }
    const src = pickString(input, ["src", "url"]);
    if (name === "show_image" && src) {
      return (
        <ToolDisplay.Section label="Image">
          <ImageDisplay src={src} alt={path} />
        </ToolDisplay.Section>
      );
    }
    // Header already covers single-path inputs — skip the JSON dump.
    if (inputCoveredByHeader(input, PATH_KEYS)) return null;
    return (
      <ToolDisplay.Section label="Input">
        <CodeDisplay
          value={JSON.stringify(input, null, 2)}
          language="json"
          copyable={false}
          showLineNumbers={false}
        />
      </ToolDisplay.Section>
    );
  })();

  const resultSection = (() => {
    if (!showOutput) return null;
    if (isError) return <ErrorInset title="Errored" detail={errorMessage} />;
    if (output === undefined) return null;

    if (name === "str_replace" || name === "write_file") {
      // Already shown in the input section; surface a concise result summary.
      const o = typeof output === "string" ? null : output;
      if (!o) return null;
      const parts: string[] = [];
      if (replacements != null) parts.push(`${replacements} replacement${replacements === 1 ? "" : "s"}`);
      const bytes = pickNumber(o, ["bytes_written", "bytesWritten", "bytes"]);
      if (bytes != null) parts.push(`${bytes.toLocaleString()} bytes written`);
      if (parts.length === 0) return null;
      return (
        <ToolDisplay.Section label="Result">
          <div className="ar-meta">{parts.join(" · ")}</div>
        </ToolDisplay.Section>
      );
    }

    // read_file or unknown IO — render output content as code
    if (!outputContent) return null;
    const charsLabel =
      typeof output === "string" ? ` · ${output.length.toLocaleString()} chars` : "";
    return (
      <ToolDisplay.Section label={`Output${charsLabel}`}>
        <CodeDisplay
          value={outputContent}
          language={lang}
          filename={path || undefined}
          maxHeight={300}
          collapsible={outputCollapsible}
          collapsedHeight={200}
        />
      </ToolDisplay.Section>
    );
  })();

  // Suppress unused-var warning for pickAny import — kept for future use.
  void pickAny;

  return (
    <ToolDisplay
      name={name}
      status={status}
      durationMs={durationMs}
      summary={summaryFor(name, path, replacements)}
      permission={event.permission}
      toolCallId={event.toolCallId}
      {...rest}
    >
      {requestSection}
      {resultSection}
    </ToolDisplay>
  );
}
