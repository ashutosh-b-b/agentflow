import { useState } from "react";
import { CodeDisplay, registerLanguage, type LanguageFn } from "../../primitives";
import { ToolCallResultDisplay } from "../../components";
import type { ToolCallEvent, ToolResultEvent } from "../../types/events";
// We import a few built-in hljs grammars *just for the docs* so the live
// switcher below has something to demonstrate without forcing a network
// install. The library itself ships 14 languages already.
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

/* --------- mylang grammar (invented for the demo) ---------
 *
 * Imagine a little DSL with `task` / `step` / `let` / `if` keywords, `;`
 * comments, double-quoted strings, and TitleCase type names. No package on
 * npm exists for this — we write the grammar inline.
 */
const MYLANG_GRAMMAR: LanguageFn = (hljs) => ({
  name: "mylang",
  aliases: ["ml-dsl"],
  keywords: {
    keyword: "task step let if else when return end of yield",
    literal: "true false null",
  },
  contains: [
    // Line comments — start with ;
    { className: "comment", begin: /;.*$/ },
    // Strings
    hljs.QUOTE_STRING_MODE,
    // Numbers
    hljs.NUMBER_MODE,
    // TitleCase identifiers → types
    { className: "type", begin: /\b[A-Z][\w]*\b/ },
    // Operators
    {
      className: "operator",
      begin: /->|=>|::|==|!=|<=|>=|<|>|=|\+|-|\*|\//,
    },
  ],
});

const MYLANG_SAMPLE = `; Fetch a URL and parse the JSON body.
task FetchUser(id: String) -> User
  step fetch
    let response = http.get("/users/" + id)
    if response.status == 200
      return User.parse(response.body)
    else
      return Error("HTTP " + response.status)
  end
end
`;

/* Built-in language switcher samples. */
const SWITCHER_SAMPLES: Record<string, string> = {
  python: `def load(path: str) -> list[Sample]:
    with open(path) as f:
        return [Sample(**row) for row in json.load(f)]`,
  typescript: `export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => { fetch(url).then(r => r.json()).then(setData); }, [url]);
  return data;
}`,
  bash: `#!/usr/bin/env bash
for f in src/**/*.ts; do
  if grep -q "TODO" "$f"; then
    echo "$f has TODOs"
  fi
done`,
  json: `{
  "name": "agentflow-ui",
  "version": "0.1.0",
  "dependencies": {
    "highlight.js": "^11"
  }
}`,
  rust: `pub struct ApiClient { base_url: String }
impl ApiClient {
    pub async fn fetch(&self, path: &str) -> Result<String, ApiError> {
        let r = reqwest::get(format!("{}{}", self.base_url, path)).await?;
        if !r.status().is_success() {
            return Err(ApiError::new(r.status().as_u16(), path));
        }
        Ok(r.text().await?)
    }
}`,
};

/* Tiny helpers for the multi-file demo. */
const t0 = Date.parse("2026-05-04T12:00:00Z");
const READ_PY_CALL: ToolCallEvent = {
  id: "tcfp",
  type: "tool_call",
  status: "complete",
  timestamp: t0,
  toolCallId: "call_py",
  toolName: "read_file",
  input: { path: "scripts/migrate.py" },
};
const READ_PY_RESULT: ToolResultEvent = {
  id: "trfp",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 100,
  toolCallId: "call_py",
  durationMs: 100,
  output: SWITCHER_SAMPLES.python,
};

const READ_TS_CALL: ToolCallEvent = {
  id: "tcfts",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 200,
  toolCallId: "call_ts",
  toolName: "read_file",
  input: { path: "src/hooks/useResource.ts" },
};
const READ_TS_RESULT: ToolResultEvent = {
  id: "trfts",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 250,
  toolCallId: "call_ts",
  durationMs: 50,
  output: SWITCHER_SAMPLES.typescript,
};

const READ_MYLANG_CALL: ToolCallEvent = {
  id: "tcfml",
  type: "tool_call",
  status: "complete",
  timestamp: t0 + 300,
  toolCallId: "call_ml",
  toolName: "read_file",
  input: { path: "tasks/fetch_user.mylang" },
};
const READ_MYLANG_RESULT: ToolResultEvent = {
  id: "trfml",
  type: "tool_result",
  status: "complete",
  timestamp: t0 + 350,
  toolCallId: "call_ml",
  durationMs: 50,
  output: MYLANG_SAMPLE,
};

/* --------- code snippets shown in the section --------- */

const SNIPPET_HLJS_LANGUAGE = `// Add a language that hljs already supports — Julia, Elixir, Solidity, etc.
// Pull the grammar from highlight.js's per-language modules and register
// it once at app startup.

import julia from "highlight.js/lib/languages/julia";
import { registerLanguage } from "agentflow-ui";

registerLanguage(julia, "julia", ".jl");

// After registration:
//   <CodeDisplay value={code} language="julia" />        ← highlights
//   IOToolDisplay rendering a *.jl file              ← highlights
`;

const SNIPPET_MYLANG_GRAMMAR = `// Write a grammar for a language hljs doesn't know about.
// Grammars are a small object — keywords, regex modes, etc.
// See https://highlightjs.readthedocs.io/en/latest/language-guide.html

import { registerLanguage, type LanguageFn } from "agentflow-ui";

const mylangGrammar: LanguageFn = (hljs) => ({
  name: "mylang",
  aliases: ["ml-dsl"],
  keywords: {
    keyword: "task step let if else when return end",
    literal: "true false null",
  },
  contains: [
    { className: "comment", begin: /;.*$/ },
    hljs.QUOTE_STRING_MODE,
    hljs.NUMBER_MODE,
    { className: "type", begin: /\\b[A-Z][\\w]*\\b/ },
    { className: "operator", begin: /->|::|==|!=|<=|>=|<|>|=|\\+|-|\\*|\\// },
  ],
});

registerLanguage(mylangGrammar, "mylang", ".mylang", ".myl");
`;

const SNIPPET_BYO = `// Bring your own highlighter — bypass hljs entirely.
// CodeDisplay's \`lines\` prop accepts pre-tokenized HTML per line.

import { CodeDisplay, type HighlightedLine } from "agentflow-ui";

function tokenizeWithShiki(code: string, lang: string): HighlightedLine[] {
  // ...your shiki / prism / lezer / custom tokenizer here...
  // produce one entry per line:
  //   { html: '<span class="hljs-keyword">def</span> ...', text: 'def ...' }
}

<CodeDisplay value={code} lines={tokenizeWithShiki(code, "julia")} />
`;

export function SyntaxHighlightingSection() {
  const [activeLang, setActiveLang] = useState<keyof typeof SWITCHER_SAMPLES>("python");
  const [mylangRegistered, setMylangRegistered] = useState(false);

  const handleRegister = () => {
    if (mylangRegistered) return;
    registerLanguage(MYLANG_GRAMMAR, "mylang", ".mylang", ".myl");
    setMylangRegistered(true);
  };

  return (
    <Section
      id="syntax-highlighting"
      eyebrow="Extending"
      title="Syntax highlighting"
    >
      <Prose>
        <p>
          Code blocks (<code>&lt;CodeDisplay&gt;</code>, and every variant
          that composes it) highlight via <strong>highlight.js</strong>. We
          ship 14 languages out of the box: TypeScript / JavaScript, Python,
          Bash, Go, Rust, JSON, Markdown, SQL, YAML, CSS, XML/HTML, Diff,
          Shell. Token colors map to the design tokens
          (<code>--code-keyword</code>, <code>--code-string</code>, …) so
          highlighted output re-themes with the rest of the page.
        </p>
        <p>
          For anything else, <strong>register your own language at
          runtime</strong>. The same call wires up both
          <code>&lt;CodeDisplay language={"<your-name>"}&gt;</code> *and* the
          file-extension detection used by <code>IOToolDisplay</code>.
        </p>
      </Prose>

      <Example
        title="Live: switch the language"
        description="Same component, different language strings. All five below ship in the default bundle."
        preview={
          <>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>language</span>
              <div className="seg" role="tablist">
                {(Object.keys(SWITCHER_SAMPLES) as (keyof typeof SWITCHER_SAMPLES)[]).map((l) => (
                  <button
                    key={l}
                    className={activeLang === l ? "active" : ""}
                    onClick={() => setActiveLang(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <CodeDisplay
              value={SWITCHER_SAMPLES[activeLang]}
              language={activeLang}
              filename={`example.${activeLang === "typescript" ? "ts" : activeLang === "python" ? "py" : activeLang === "bash" ? "sh" : activeLang === "json" ? "json" : "rs"}`}
            />
          </>
        }
      />

      {/* hljs-supported language */}
      <Example
        title="Adding a hljs-supported language (Julia, Elixir, Solidity, …)"
        description="If a community grammar exists, it's a one-line registration. The grammar comes from highlight.js's per-language module; you tell us the canonical name and the file extensions you want mapped."
        code={<CodeBlock code={SNIPPET_HLJS_LANGUAGE} filename="app.tsx" />}
      />

      {/* invented mylang */}
      <Example
        title="Adding a language hljs doesn't know about — mylang"
        description='Imagine a small DSL ("mylang"): tasks made of steps, ; comments, TitleCase types. No npm package exists for it. Write the grammar yourself — keyword list + a few regex modes — and register it. Click "Register mylang" below to see the same source render plain text → fully highlighted.'
        preview={
          <>
            <div className="docs-controls">
              <button
                className="btn"
                onClick={handleRegister}
                disabled={mylangRegistered}
              >
                {mylangRegistered ? "✓ mylang registered" : "Register mylang"}
              </button>
              <span
                style={{
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {mylangRegistered
                  ? "the grammar is live; fields below re-tokenize"
                  : "before registration: language unknown → plain text"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="vlabel" style={{ marginBottom: 6 }}>
                  &lt;CodeDisplay language="mylang" /&gt;
                </div>
                {/* key forces remount so memoized tokenization re-runs */}
                <CodeDisplay
                  key={mylangRegistered ? "ml-on" : "ml-off"}
                  value={MYLANG_SAMPLE}
                  language="mylang"
                  filename="example.mylang"
                />
              </div>
              <div>
                <div className="vlabel" style={{ marginBottom: 6 }}>
                  Same source rendered through IOToolDisplay's path detection
                  (.mylang extension)
                </div>
                <ToolCallResultDisplay
                  key={mylangRegistered ? "mlt-on" : "mlt-off"}
                  call={READ_MYLANG_CALL}
                  result={READ_MYLANG_RESULT}
                  defaultExpanded
                />
              </div>
            </div>
          </>
        }
        code={<CodeBlock code={SNIPPET_MYLANG_GRAMMAR} filename="mylang.ts" />}
      />

      {/* multi-file conversation */}
      <Example
        title="Multi-file conversations"
        description={
          <>
            Each tool call's <code>&lt;CodeDisplay&gt;</code> picks its
            language from the file extension independently — so a
            conversation reading a Python file and a TypeScript file in
            consecutive turns shows two cards each highlighted with their own
            language. Add more languages via{" "}
            <code>registerLanguage(grammar, name, ".ext")</code> and they
            light up automatically.
          </>
        }
        preview={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ToolCallResultDisplay
              call={READ_PY_CALL}
              result={READ_PY_RESULT}
              defaultExpanded
            />
            <ToolCallResultDisplay
              call={READ_TS_CALL}
              result={READ_TS_RESULT}
              defaultExpanded
            />
          </div>
        }
      />

      {/* bring your own */}
      <Example
        title="Bring your own highlighter (shiki, prism, lezer, …)"
        description="If hljs doesn't fit your needs at all — say you're already running shiki for the rest of your app and want exact parity — bypass it entirely. Pre-tokenize the source yourself and pass the result via the lines prop. No grammar registration, no hljs lookup."
        code={<CodeBlock code={SNIPPET_BYO} filename="app.tsx" />}
      />

      <Prose>
        <p>
          <strong>What about a language with no community grammar?</strong>{" "}
          Same path as <em>mylang</em> above — write a small grammar (the{" "}
          <code>keywords</code> list + a handful of regex modes is usually
          enough for ~95% accuracy) and call <code>registerLanguage</code>.
          Custom DSLs, in-house simulation languages, agent-emitted
          pseudo-code — all in the same shape.
        </p>
        <p>
          <strong>What about file extensions that don't match the
          name?</strong> Pass them as additional arguments:{" "}
          <code>registerLanguage(grammar, "mylang", ".mylang", ".myl")</code>.
          The first argument after the name is the canonical extension; any
          number of extra extensions can map to the same grammar.
        </p>
      </Prose>
    </Section>
  );
}
