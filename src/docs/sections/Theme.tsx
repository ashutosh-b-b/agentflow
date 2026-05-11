import { useEffect, useMemo, useState } from "react";
import { ConversationView } from "../../components";
import type { ConversationEvent } from "../../types/events";
import { CodeBlock } from "../components/CodeBlock";
import { Example, Prose, Section } from "../components/Example";

const t0 = Date.parse("2026-05-04T12:00:00Z");
const EVENTS: ConversationEvent[] = [
  {
    id: "u",
    type: "user_message",
    status: "complete",
    timestamp: t0,
    content: "Show me the design tokens at work.",
  },
  {
    id: "a",
    type: "assistant_message",
    status: "complete",
    timestamp: t0 + 800,
    content:
      "Every visual element pulls from `--bg-*`, `--fg-*`, `--accent-*`, `--code-*`. Tweak any of them on the right; the preview re-themes live.",
    finishReason: "tool_calls",
  },
  {
    id: "tc",
    type: "tool_call",
    status: "complete",
    timestamp: t0 + 900,
    toolCallId: "call_grep",
    toolName: "grep",
    input: { pattern: "--accent-1" },
  },
  {
    id: "tr",
    type: "tool_result",
    status: "complete",
    timestamp: t0 + 970,
    toolCallId: "call_grep",
    durationMs: 70,
    output: {
      totalMatches: 2,
      totalFiles: 1,
      matches: [
        {
          file: "src/styles/tokens.css",
          lines: [
            { lineNo: 100, text: "  --accent-1: #8aa9ff;" },
            { lineNo: 184, text: "  --accent-1: #4f6ed4;" },
          ],
        },
      ],
    },
  },
];

interface TokenSpec {
  name: string;
  cssVar: string;
  defaultDark: string;
  defaultLight: string;
}

const TOKENS: TokenSpec[] = [
  { name: "page bg",        cssVar: "--bg-0",        defaultDark: "#0c0e12", defaultLight: "#f6f7f9" },
  { name: "panel bg",       cssVar: "--bg-1",        defaultDark: "#12151b", defaultLight: "#ffffff" },
  { name: "raised bg",      cssVar: "--bg-2",        defaultDark: "#181c24", defaultLight: "#fbfbfd" },
  { name: "primary text",   cssVar: "--fg-1",        defaultDark: "#e7eaf0", defaultLight: "#1a1d23" },
  { name: "muted text",     cssVar: "--fg-3",        defaultDark: "#7c828f", defaultLight: "#6b7280" },
  { name: "accent",         cssVar: "--accent-1",    defaultDark: "#8aa9ff", defaultLight: "#4f6ed4" },
  { name: "success",        cssVar: "--success",     defaultDark: "#86d4a3", defaultLight: "#2f9d5f" },
  { name: "danger",         cssVar: "--danger",      defaultDark: "#f08a8a", defaultLight: "#cc4b4b" },
  { name: "purple (think)", cssVar: "--purple",      defaultDark: "#c4a8f0", defaultLight: "#8a5dc4" },
  { name: "code keyword",   cssVar: "--code-keyword", defaultDark: "#c4a8f0", defaultLight: "#8a5dc4" },
  { name: "code string",    cssVar: "--code-string",  defaultDark: "#86d4a3", defaultLight: "#2f9d5f" },
  { name: "code number",    cssVar: "--code-number",  defaultDark: "#f0c674", defaultLight: "#b87a14" },
];

const TOKENS_USAGE = `/* Override at :root or any ancestor — every component re-themes. */
:root {
  --accent-1: #ff8c42;
  --accent-1-soft: #3a2415;
  --accent-1-soft-fg: #ffb277;
  --code-keyword: #ff8c42;
}

/* Or per-section: */
.brand-experimental {
  --accent-1: hsl(280 60% 65%);
}
`;

export function ThemeSection() {
  const [scheme, setScheme] = useState<"dark" | "light">("dark");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Reset overrides when the user flips dark/light so the swatch defaults
  // match the current scheme.
  useEffect(() => {
    setOverrides({});
  }, [scheme]);

  const styleOverrides = useMemo<React.CSSProperties>(() => {
    const out: React.CSSProperties = {};
    for (const [k, v] of Object.entries(overrides)) {
      (out as Record<string, string>)[k] = v;
    }
    return out;
  }, [overrides]);

  return (
    <Section id="theme" eyebrow="Extending" title="Theming">
      <Prose>
        <p>
          The whole library reads from a single set of CSS variables defined
          in <code>tokens.css</code>. Override any of them at <code>:root</code>
          {" "}or on any ancestor — every component re-themes instantly. Light
          and dark are just two presets keyed off <code>data-theme</code>.
        </p>
      </Prose>

      <Example
        title="Live token playground"
        description="Pick a base scheme on the left, edit any token, watch the same conversation re-theme. The pickers write CSS variables on the preview wrapper so the rest of the page is unaffected."
        preview={
          <div data-theme={scheme} style={styleOverrides}>
            <div className="docs-controls">
              <span style={{ color: "var(--fg-3)" }}>scheme</span>
              <div className="seg" role="tablist">
                <button
                  className={scheme === "dark" ? "active" : ""}
                  onClick={() => setScheme("dark")}
                >
                  dark
                </button>
                <button
                  className={scheme === "light" ? "active" : ""}
                  onClick={() => setScheme("light")}
                >
                  light
                </button>
              </div>
              <button
                className="btn"
                onClick={() => setOverrides({})}
                disabled={Object.keys(overrides).length === 0}
              >
                Reset overrides
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr",
                gap: 18,
                padding: 18,
              }}
            >
              <div className="docs-swatches" style={{ gridTemplateColumns: "1fr" }}>
                {TOKENS.map((t) => {
                  const fallback = scheme === "dark" ? t.defaultDark : t.defaultLight;
                  const current = overrides[t.cssVar] ?? fallback;
                  return (
                    <label key={t.cssVar} className="docs-swatch">
                      <span className="chip" style={{ background: current }} />
                      <span style={{ flex: 1 }}>
                        <div style={{ color: "var(--fg-1)" }}>{t.name}</div>
                        <div style={{ color: "var(--fg-3)" }}>{t.cssVar}</div>
                      </span>
                      <input
                        type="color"
                        value={normalizeHex(current)}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [t.cssVar]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div>
                <ConversationView events={EVENTS} mode="chat" />
              </div>
            </div>
          </div>
        }
        code={<CodeBlock code={TOKENS_USAGE} filename="theme-overrides.css" language="css" />}
      />
    </Section>
  );
}

/** color inputs only accept #rrggbb. Non-hex tokens fall back to a neutral. */
function normalizeHex(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#888888";
}
