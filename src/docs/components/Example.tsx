import type { ReactNode } from "react";

/**
 * Layout for an interactive docs example: optional title, the live render,
 * and (optionally) a code panel beneath. Two columns above ~960px, stacked
 * below.
 */
export function Example({
  title,
  description,
  preview,
  code,
}: {
  title?: string;
  description?: ReactNode;
  preview?: ReactNode;
  code?: ReactNode;
}) {
  return (
    <div className="docs-example">
      {(title || description) && (
        <div className="docs-example-head">
          {title && <h4>{title}</h4>}
          {description && <p>{description}</p>}
        </div>
      )}
      <div className="docs-example-grid">
        {preview != null && <div className="docs-example-preview">{preview}</div>}
        {code && <div className="docs-example-code">{code}</div>}
      </div>
    </div>
  );
}

export function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="docs-section">
      <header className="docs-section-head">
        {eyebrow && <div className="docs-section-eyebrow">{eyebrow}</div>}
        <h2 className="docs-section-title">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="docs-prose">{children}</div>;
}
