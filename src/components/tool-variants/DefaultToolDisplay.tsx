import { CodeDisplay } from "../../primitives/CodeDisplay";
import { ToolDisplay } from "../ToolDisplay";
import { ErrorInset } from "./ErrorInset";
import type { ToolVariantProps } from "./types";

/** Fallback variant — JSON dumps for input + output. Used when the registry
 *  has no entry for `event.name`. */
export function DefaultToolDisplay({
  event,
  mode = "merged",
  inputCollapsible = true,
  outputCollapsible = true,
  ...rest
}: ToolVariantProps) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  const showInput = mode === "request" || mode === "merged";
  const showOutput = mode === "merged";

  const summary = (() => {
    try {
      const s = JSON.stringify(input);
      return s.length > 80 ? `${s.slice(0, 77)}…` : s;
    } catch {
      return "";
    }
  })();

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
      {showInput && (
        <ToolDisplay.Section label="Input">
          <CodeDisplay
            value={safeStringify(input)}
            language="json"
            showLineNumbers={false}
            copyable={false}
            maxHeight={200}
            collapsible={inputCollapsible}
            collapsedHeight={120}
          />
        </ToolDisplay.Section>
      )}
      {showOutput && (
        isError ? (
          <ErrorInset title="Errored" detail={errorMessage} />
        ) : (
          output !== undefined && (
            <ToolDisplay.Section label="Output">
              <CodeDisplay
                value={safeStringify(output)}
                language="json"
                showLineNumbers={false}
                copyable={false}
                maxHeight={300}
                collapsible={outputCollapsible}
                collapsedHeight={200}
              />
            </ToolDisplay.Section>
          )
        )
      )}
    </ToolDisplay>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
