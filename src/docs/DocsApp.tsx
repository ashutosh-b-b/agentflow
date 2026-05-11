import { useEffect, useState } from "react";
import { Sidebar, type NavItem } from "./Sidebar";
import { Logo } from "./components/Logo";

import { BasicsSection } from "./sections/Basics";
import { AdaptersSection } from "./sections/Adapters";
import { CustomToolsSection } from "./sections/CustomTools";
import { ThemeSection } from "./sections/Theme";
import { CustomComponentsSection } from "./sections/CustomComponents";
import { SyntaxHighlightingSection } from "./sections/SyntaxHighlighting";
import { ConversationViewSection } from "./sections/ConversationViewFeatures";
import { ComponentsPage, COMPONENTS_NAV } from "./pages/ComponentsPage";
import { IntegrationPage, INTEGRATION_NAV } from "./pages/IntegrationPage";
import { LandingPage } from "./pages/LandingPage";

type PageId = "home" | "docs" | "components" | "integration";

interface PageDef {
  id: PageId;
  label: string;
  nav: NavItem[];
  /** Hide sidebar entirely on this page (the landing page). */
  noSidebar?: boolean;
}

const DOCS_NAV: NavItem[] = [
  { id: "basics", label: "Basics", group: "Getting started" },
  { id: "adapters", label: "Writing adapters", group: "Extending" },
  { id: "custom-tools", label: "Custom tool displays", group: "Extending" },
  { id: "custom-components", label: "Custom components", group: "Extending" },
  { id: "syntax-highlighting", label: "Syntax highlighting", group: "Extending" },
  { id: "theme", label: "Theming", group: "Extending" },
  { id: "conversation-view", label: "ConversationView features", group: "Reference" },
];

const PAGES: PageDef[] = [
  { id: "home", label: "Home", nav: [], noSidebar: true },
  { id: "docs", label: "Docs", nav: DOCS_NAV },
  { id: "components", label: "Components", nav: COMPONENTS_NAV },
  { id: "integration", label: "Integration", nav: INTEGRATION_NAV },
];

/**
 * Returns the requested page from the URL hash, or null if the hash points
 * at a within-page section anchor (e.g. `#comp-primitives`). Only the
 * explicit `#/<page>` form changes pages.
 */
function readPage(): PageId | null {
  const hash = (typeof window !== "undefined" ? window.location.hash : "") || "";
  // `#/` (or empty) → home. `#/docs` → docs. etc.
  if (hash === "" || hash === "#" || hash === "#/") return "home";
  const m = hash.match(/^#\/([^/]+)/);
  const id = m?.[1];
  if (id === "home" || id === "docs" || id === "components" || id === "integration") {
    return id;
  }
  return null;
}

export function DocsApp() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [page, setPage] = useState<PageId>(() => readPage() ?? "home");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onHash = () => {
      const next = readPage();
      if (next) setPage(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setPageAndHash = (id: PageId) => {
    setPage(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", id === "home" ? "#/" : `#/${id}`);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  };

  const active = PAGES.find((p) => p.id === page) ?? PAGES[0];

  // Shared top bar across all pages.
  const topBar = (
    <header className="site-topbar">
      <a
        href="#/"
        className="site-brand"
        aria-label="Agentflow home"
        onClick={(e) => {
          e.preventDefault();
          setPageAndHash("home");
        }}
      >
        <Logo size={22} />
        <span className="site-brand-name">agentflow</span>
      </a>
      <nav className="site-nav" role="tablist" aria-label="Sections">
        {PAGES.filter((p) => p.id !== "home").map((p) => (
          <button
            key={p.id}
            className={page === p.id ? "active" : ""}
            onClick={() => setPageAndHash(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="site-topbar-actions">
        <a
          className="site-link"
          href="https://github.com/"
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub
        </a>
        <div className="theme-switch" role="tablist" aria-label="Theme">
          <button
            className={theme === "dark" ? "active" : ""}
            onClick={() => setTheme("dark")}
            aria-label="Dark theme"
          >
            dark
          </button>
          <button
            className={theme === "light" ? "active" : ""}
            onClick={() => setTheme("light")}
            aria-label="Light theme"
          >
            light
          </button>
        </div>
      </div>
    </header>
  );

  if (active.noSidebar) {
    // Landing page: full-width below the shared topbar.
    return (
      <div className="site-shell">
        {topBar}
        <main className="site-main">
          <LandingPage />
        </main>
      </div>
    );
  }

  // Docs / Components / Integration: sidebar + topbar.
  return (
    <div className="site-shell with-sidebar">
      {topBar}
      <div className="docs-app">
        <Sidebar items={active.nav} />
        <main className="docs-main">
          {page === "docs" && (
            <>
              <BasicsSection />
              <AdaptersSection />
              <CustomToolsSection />
              <CustomComponentsSection />
              <SyntaxHighlightingSection />
              <ThemeSection />
              <ConversationViewSection />
            </>
          )}
          {page === "components" && <ComponentsPage />}
          {page === "integration" && <IntegrationPage />}
        </main>
      </div>
    </div>
  );
}
