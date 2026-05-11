import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

export interface PropDef {
  name: string;
  type: string;
  default?: string;
  description?: string;
}

export function ComponentCard({
  id,
  name,
  kind,
  description,
  preview,
  props,
  code,
  filename,
  language = "tsx",
  notes,
}: {
  id?: string;
  name: string;
  kind?: string;
  description?: ReactNode;
  preview?: ReactNode;
  props?: PropDef[];
  code?: string;
  filename?: string;
  language?: string;
  notes?: ReactNode;
}) {
  return (
    <article id={id} className="comp-card">
      <header className="comp-card-head">
        <div className="comp-card-title">
          <code className="comp-card-name">{name}</code>
          {kind && <span className="comp-card-kind">{kind}</span>}
        </div>
        {description && <p className="comp-card-desc">{description}</p>}
      </header>
      {preview != null && (
        <div className="comp-card-section comp-card-preview-section">
          <div className="comp-card-section-label">Preview</div>
          <div className="comp-card-preview-stage">{preview}</div>
        </div>
      )}
      {props && props.length > 0 && (
        <div className="comp-card-section">
          <div className="comp-card-section-label">Props</div>
          <table className="comp-card-props-table">
            <thead>
              <tr>
                <th>name</th>
                <th>type</th>
                <th>default</th>
                <th>description</th>
              </tr>
            </thead>
            <tbody>
              {props.map((p) => (
                <tr key={p.name}>
                  <td>
                    <code>{p.name}</code>
                  </td>
                  <td>
                    <code>{p.type}</code>
                  </td>
                  <td>{p.default ? <code>{p.default}</code> : "—"}</td>
                  <td>{p.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {code && (
        <div className="comp-card-section">
          <div className="comp-card-section-label">Usage</div>
          <CodeBlock code={code} filename={filename} language={language} />
        </div>
      )}
      {notes && (
        <div className="comp-card-section comp-card-notes">
          <div className="comp-card-section-label">Notes</div>
          {notes}
        </div>
      )}
    </article>
  );
}

export function TierGroup({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="comp-tier">
      <header className="comp-tier-head">
        <h2 className="comp-tier-title">{title}</h2>
        {description && <p className="comp-tier-desc">{description}</p>}
      </header>
      <div className="comp-tier-body">{children}</div>
    </section>
  );
}
