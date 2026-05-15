import { useState } from "react";
import {
  ConversationView,
  ToolDisplay,
  type ToolVariantComponent,
  type ToolVariantProps,
} from "../../components";
import { CodeDisplay } from "../../primitives";
import { ErrorInset } from "../../components/tool-variants";
import type { ConversationEvent } from "../../types/events";
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

/* --------- the "without registry" demo ---------
 * A tool the registry doesn't know about — falls through to DefaultToolDisplay
 * (a JSON dump). Same event will re-render with our custom variant when it's
 * registered.
 */

interface JuliaInput {
  code: string;
  package_imports?: string[];
}
interface JuliaOutput {
  result: string;
  stdout?: string;
  errored?: boolean;
  error?: string;
}

const t0 = Date.parse("2026-05-04T12:00:00Z");

const EVENTS: ConversationEvent[] = [
  {
    id: "u",
    type: "user_message",
    status: "complete",
    timestamp: t0,
    content: "What's `det([1 2; 3 4])` in Julia?",
  },
  {
    id: "a",
    type: "assistant_message",
    status: "complete",
    timestamp: t0 + 1_000,
    content: "Running it through `julia_eval`:",
    finishReason: "tool_calls",
  },
  {
    id: "tc",
    type: "tool_call",
    status: "complete",
    timestamp: t0 + 1_100,
    toolCallId: "call_jl_1",
    toolName: "julia_eval",
    input: { code: "using LinearAlgebra\nA = [1 2; 3 4]\ndet(A)" } satisfies JuliaInput,
  },
  {
    id: "tr",
    type: "tool_result",
    status: "complete",
    timestamp: t0 + 1_256,
    toolCallId: "call_jl_1",
    durationMs: 156,
    output: { result: "-2.0", stdout: "" } satisfies JuliaOutput,
  },
  {
    id: "a2",
    type: "assistant_message",
    status: "complete",
    timestamp: t0 + 1_400,
    content: "It's **−2.0** — `[1 2; 3 4]` is invertible.",
  },
];

/* --------- the custom variant ---------
 * Render Julia code with proper highlighting, then the result + stdout
 * separately. Honors `mode='request'` (input only) so it works folded inside
 * an AssistantMessage too.
 */
function JuliaToolDisplay({
  event,
  mode = "merged",
  inputCollapsible = true,
  outputCollapsible = true,
  ...rest
}: ToolVariantProps<JuliaInput, JuliaOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;
  const summary = (input.code.split("\n")[0] ?? "").trim() || "julia";
  const showInput = mode === "request" || mode === "merged";
  const showOutput = mode === "merged";
  const errored = isError || output?.errored;

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
      {showInput && (
        <ToolDisplay.Section label="Code">
          <CodeDisplay
            value={input.code}
            language="julia"
            copyable
            collapsible={inputCollapsible}
            collapsedHeight={200}
          />
        </ToolDisplay.Section>
      )}
      {showOutput && errored && (
        <ErrorInset
          title={output?.error?.split("\n")[0] ?? "Errored"}
          detail={errorMessage ?? output?.error}
        />
      )}
      {showOutput && !errored && output?.stdout && (
        <ToolDisplay.Section label="stdout">
          <CodeDisplay
            value={output.stdout}
            showLineNumbers={false}
            copyable={false}
          />
        </ToolDisplay.Section>
      )}
      {showOutput && !errored && output?.result && (
        <ToolDisplay.Section label="Result">
          <CodeDisplay
            value={output.result}
            language="julia"
            showLineNumbers={false}
            copyable={false}
            collapsible={outputCollapsible}
            collapsedHeight={200}
          />
        </ToolDisplay.Section>
      )}
    </ToolDisplay>
  );
}

const CODE = `import {
  ToolDisplay,
  CodeDisplay,
  ErrorInset,
  type ToolVariantProps,
} from "agentflow-ui";

interface JuliaInput  { code: string; package_imports?: string[] }
interface JuliaOutput { result: string; stdout?: string; errored?: boolean; error?: string }

export function JuliaToolDisplay({
  event, mode = "merged", ...rest
}: ToolVariantProps<JuliaInput, JuliaOutput>) {
  const { name, status, durationMs, input, output, isError, errorMessage } = event;
  const summary = (input.code.split("\\n")[0] ?? "").trim() || "julia";
  const showInput  = mode === "request" || mode === "merged";
  const showOutput = mode === "merged";
  const errored = isError || output?.errored;

  return (
    <ToolDisplay
      name={name} status={status} durationMs={durationMs} summary={summary}
      permission={event.permission} toolCallId={event.toolCallId} {...rest}
    >
      {showInput && (
        <ToolDisplay.Section label="Code">
          <CodeDisplay value={input.code} language="julia" copyable
                       collapsible collapsedHeight={200} />
        </ToolDisplay.Section>
      )}
      {showOutput && errored && (
        <ErrorInset
          title={output?.error?.split("\\n")[0] ?? "Errored"}
          detail={errorMessage ?? output?.error}
        />
      )}
      {showOutput && !errored && output?.result && (
        <ToolDisplay.Section label="Result">
          <CodeDisplay value={output.result} language="julia"
                       showLineNumbers={false} copyable={false} />
        </ToolDisplay.Section>
      )}
    </ToolDisplay>
  );
}

// register it:
<ConversationView
  events={events}
  toolVariants={{ julia_eval: JuliaToolDisplay }}
/>
`;

export function CustomToolsSection() {
  const [registered, setRegistered] = useState(true);
  const variants: Record<string, ToolVariantComponent<unknown, unknown>> = registered
    ? { julia_eval: JuliaToolDisplay as ToolVariantComponent<unknown, unknown> }
    : {};

  return (
    <Section id="custom-tools" eyebrow="Extending" title="Custom tool displays">
      <Prose>
        <p>
          Tool variants are React components keyed by tool name. They receive
          a merged <code>ToolEventLike</code> with the tool's input + output
          and return a <code>&lt;ToolDisplay&gt;</code> tree. Unknown tools
          fall through to <code>DefaultToolDisplay</code>, a JSON dump — so
          you never crash on a tool you haven't styled, you just get a
          readable fallback.
        </p>
      </Prose>

      <Example
        title="Toggle: register or omit the variant"
        description="The same event stream renders through DefaultToolDisplay (left) or your JuliaToolDisplay (right) depending on the toolVariants prop."
        preview={
          <>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>variant</span>
              <div className="seg" role="tablist">
                <button
                  className={!registered ? "active" : ""}
                  onClick={() => setRegistered(false)}
                >
                  default JSON
                </button>
                <button
                  className={registered ? "active" : ""}
                  onClick={() => setRegistered(true)}
                >
                  custom JuliaToolDisplay
                </button>
              </div>
            </div>
            <ConversationView events={EVENTS} toolVariants={variants} />
          </>
        }
        code={<CodeBlock code={CODE} filename="JuliaToolDisplay.tsx" />}
      />
    </Section>
  );
}
