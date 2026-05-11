import { useEffect, useState } from "react";
import { Logo } from "./components/Logo";

export interface NavItem {
  id: string;
  label: string;
  group?: string;
}

export function Sidebar({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  // Track which section is in view to highlight the matching nav link.
  useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The section closest to the top of the viewport (with positive
        // bounding rect) is the current one.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );

    for (const el of sections) observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  const groups = new Map<string, NavItem[]>();
  for (const it of items) {
    const g = it.group ?? "";
    const arr = groups.get(g) ?? [];
    arr.push(it);
    groups.set(g, arr);
  }

  return (
    <aside className="docs-sidebar">
      <a href="#/" className="docs-brand" aria-label="Home">
        <Logo size={24} />
        <div className="docs-brand-text">
          <h1>agentflow</h1>
          <span className="sub">interactive docs</span>
        </div>
      </a>
      <nav className="docs-nav">
        {[...groups.entries()].map(([group, list]) => (
          <div key={group || "_"}>
            {group && <div className="label">{group}</div>}
            {list.map((it) => (
              <a
                key={it.id}
                href={`#${it.id}`}
                className={active === it.id ? "active" : undefined}
              >
                {it.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="docs-side-foot">
        <span>plan.md · docs/ · src/</span>
      </div>
    </aside>
  );
}
