import { CodeDisplay } from "../../primitives/CodeDisplay";
import { ToolDisplay } from "../ToolDisplay";
import { ErrorInset } from "./ErrorInset";
import {
  COMMAND_KEYS,
  EXIT_CODE_KEYS,
  STDERR_KEYS,
  STDOUT_KEYS,
  pickNumber,
  pickString,
} from "./fields";
import type { ToolVariantProps } from "./types";

/**
 * bash / shell. Accepts:
 *   command  : command | cmd | script | shell
 *   stdout   : stdout | out | std_out
 *   stderr   : stderr | err | std_err
 *   exitCode : exitCode | exit_code | exit | status | code
 */
type BashInput = Record<string, unknown>;
type BashOutput = Record<string, unknown>;

export function BashToolDisplay({
  event,
  mode = "merged",
  outputCollapsible = true,
  ...rest
}: ToolVariantProps<BashInput, BashOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;

  const command = pickString(input, COMMAND_KEYS) ?? "";
  const stdout = pickString(output, STDOUT_KEYS);
  const stderr = pickString(output, STDERR_KEYS);
  const exitCode = pickNumber(output, EXIT_CODE_KEYS);

  const showInput = mode === "request" || mode === "merged";
  const showOutput = mode === "merged";

  // Tint the dot when the command exited non-zero — best-effort only when
  // the consumer didn't already set isError. Note: tools where non-zero
  // exit isn't a true error (ripgrep, git diff) should set okExitCodes
  // via the inferIsError adapter helper so isError stays false.
  const effectiveStatus =
    showOutput && !isError && exitCode != null && exitCode !== 0 && status === "complete"
      ? "error"
      : status;

  return (
    <ToolDisplay
      name={name}
      status={effectiveStatus}
      durationMs={durationMs}
      costUsd={event.costUsd}
      tokens={event.tokens}
      summary={command}
      permission={event.permission}
      toolCallId={event.toolCallId}
      {...rest}
    >
      {showInput && (
        <ToolDisplay.Section label="$ command">
          <CodeDisplay
            value={command}
            language="bash"
            copyable={!!command}
            showLineNumbers={false}
          />
        </ToolDisplay.Section>
      )}
      {showOutput &&
        (isError ? (
          <ErrorInset title="Errored" detail={errorMessage} />
        ) : exitCode != null && exitCode !== 0 ? (
          <ToolDisplay.ExitInfo
            exitCode={exitCode}
            stderr={stderr}
            command={name}
          />
        ) : (
          <>
            {stdout && (
              <ToolDisplay.Section label="stdout">
                <CodeDisplay
                  value={stdout}
                  language="bash"
                  showLineNumbers={false}
                  copyable={false}
                  maxHeight={300}
                  collapsible={outputCollapsible}
                  collapsedHeight={200}
                />
              </ToolDisplay.Section>
            )}
            {stderr && (
              <ToolDisplay.Section label="stderr" danger>
                <CodeDisplay
                  value={stderr}
                  language="bash"
                  showLineNumbers={false}
                  copyable={false}
                  className="danger"
                  maxHeight={200}
                  collapsible={outputCollapsible}
                  collapsedHeight={150}
                />
              </ToolDisplay.Section>
            )}
            {exitCode != null && status !== "running" && (
              <div className="ar-meta">exit {exitCode}</div>
            )}
          </>
        ))}
    </ToolDisplay>
  );
}
