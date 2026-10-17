"use client";

/**
 * Application shell: persistent sidebar, top bar and command access.
 * The demo-mode indicator is always visible — the workspace must never be
 * mistaken for a connected scientific backend.
 */

import * as React from "react";
import {
  LayoutDashboard,
  Play,
  Database,
  History,
  ScrollText,
  FileText,
  LineChart,
  Settings,
  Menu,
  Search,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wordmark } from "@/components/bioagent/common/Wordmark";
import { Kbd } from "@/components/bioagent/common/primitives";
import { useHashRouter, isRouteActive, APP_ROUTES } from "@/lib/bioagent/router";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";

const NAV_ITEMS = [
  { label: "Overview", route: APP_ROUTES.overview, icon: LayoutDashboard },
  { label: "New Analysis", route: APP_ROUTES.newAnalysis, icon: Play },
  { label: "Datasets", route: APP_ROUTES.datasets, icon: Database },
  { label: "Runs", route: APP_ROUTES.runs, icon: History },
  { label: "Evidence Ledger", route: APP_ROUTES.evidence, icon: ScrollText },
  { label: "Reports", route: APP_ROUTES.reports, icon: FileText },
  { label: "Evaluation", route: APP_ROUTES.evaluation, icon: LineChart },
  { label: "Settings", route: APP_ROUTES.settings, icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { path, navigate } = useHashRouter();
  const activeRunId = useBioAgentStore((s) => s.activeRunId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-border px-4">
        <button
          type="button"
          className="ba-focus rounded"
          onClick={() => {
            navigate("/");
            onNavigate?.();
          }}
          aria-label="BioAgent-ST home"
        >
          <Wordmark />
        </button>
      </div>
      <nav className="ba-scroll flex-1 overflow-y-auto px-2 py-3" aria-label="Workspace sections">
        <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Research workspace
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(path, item.route);
            const isRunning = item.route === APP_ROUTES.runs && activeRunId !== null;
            return (
              <li key={item.route}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ba-focus group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-primary"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                  onClick={() => {
                    navigate(item.route);
                    onNavigate?.();
                  }}
                >
                  <item.icon className={cn("size-4 shrink-0", active && "text-teal")} aria-hidden />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isRunning && (
                    <span className="size-1.5 animate-pulse rounded-full bg-teal" aria-label="A run is in progress" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <FlaskConical className="size-3.5" aria-hidden />
            Demo Mode
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            All datasets, runs and results are illustrative and generated locally in your browser. No
            scientific backend is connected.
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoModeIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning"
      title="Demo Mode: illustrative local data; no scientific backend connected"
    >
      <FlaskConical className="size-3" aria-hidden />
      Demo Mode
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { path, navigate } = useHashRouter();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const dataset = useBioAgentStore((s) => s.dataset);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = path
    .split("/")
    .filter(Boolean)
    .slice(1);
  const sectionLabel =
    NAV_ITEMS.find((n) => isRouteActive(path, n.route))?.label ?? (crumbs[0] === "app" ? "Workspace" : "Overview");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 lg:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
            <button
              type="button"
              className="ba-focus truncate rounded text-muted-foreground hover:text-foreground"
              onClick={() => navigate(APP_ROUTES.overview)}
            >
              Workspace
            </button>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            <span className="truncate font-medium text-foreground" aria-current="page">
              {sectionLabel}
            </span>
            {crumbs.length > 1 && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                <span className="truncate font-mono text-xs text-muted-foreground">{crumbs[crumbs.length - 1]}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {dataset ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="ba-focus hidden max-w-[16rem] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground sm:flex"
                    onClick={() => navigate(APP_ROUTES.datasets)}
                    aria-label={`Active dataset: ${dataset.meta.name}`}
                  >
                    <span className="size-2 shrink-0 rounded-full bg-verified" aria-hidden />
                    <span className="truncate font-medium">{dataset.meta.shortId}</span>
                    <span className="hidden shrink-0 text-muted-foreground md:inline">
                      {dataset.meta.obsCountLabel}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{dataset.meta.name} — open dataset details</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                className="ba-focus hidden items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground sm:flex"
                onClick={() => navigate(APP_ROUTES.datasets)}
              >
                <span className="size-2 rounded-full border border-border bg-secondary" aria-hidden />
                No dataset
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-muted-foreground"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
            >
              <Search className="size-3.5" aria-hidden />
              <span className="hidden md:inline">Search…</span>
              <span className="hidden md:inline">
                <Kbd>Ctrl K</Kbd>
              </span>
            </Button>
            <DemoModeIndicator />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
