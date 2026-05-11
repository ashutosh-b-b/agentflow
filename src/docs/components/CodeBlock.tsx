import { CodeDisplay } from "../../primitives/CodeDisplay";

/**
 * Thin docs-flavored wrapper around CodeDisplay — defaults: tsx language,
 * filename caption, no clamp.
 */
export function CodeBlock({
  code,
  language = "tsx",
  filename,
}: {
  code: string;
  language?: string;
  filename?: string;
}) {
  return (
    <CodeDisplay
      value={code}
      language={language}
      filename={filename}
      showLineNumbers={false}
      maxHeight={420}
      copyable
    />
  );
}
