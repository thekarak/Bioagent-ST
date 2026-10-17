"use client";

/**
 * BioAgent-ST application root.
 *
 * The preview environment exposes a single Next.js route, so the landing page
 * ("#/") and the research dashboard ("#/app/…") are served through hash
 * segments with full navigation, active states, deep links and back/forward
 * support.
 */

import * as React from "react";
import { useHashRouter } from "@/lib/bioagent/router";
import { AppShell } from "@/components/bioagent/shell/AppShell";
import { LandingPage } from "@/components/bioagent/landing/LandingPage";
import { OverviewPage } from "@/components/bioagent/pages/OverviewPage";
import { NewAnalysisPage } from "@/components/bioagent/pages/NewAnalysisPage";
import { DatasetsPage } from "@/components/bioagent/pages/DatasetsPage";
import { RunsPage } from "@/components/bioagent/pages/RunsPage";
import { RunDetailPage } from "@/components/bioagent/pages/run-detail/RunDetailPage";
import { EvidenceLedgerPage } from "@/components/bioagent/pages/EvidenceLedgerPage";
import { ReportsPage } from "@/components/bioagent/pages/ReportsPage";
import { EvaluationPage } from "@/components/bioagent/pages/EvaluationPage";
import { SettingsPage } from "@/components/bioagent/pages/SettingsPage";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/bioagent/common/primitives";
import { navigateTo } from "@/lib/bioagent/router";

export function BioAgentApp() {
  const { path, segments } = useHashRouter();
  // Render the landing page until mounted so SSR markup and the first client
  // render match; afterwards the hash route takes over.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Scroll to top on route change.
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  if (!mounted || path === "/") {
    return <LandingPage />;
  }

  if (segments[0] !== "app") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <EmptyState
          title="Unknown route"
          description={`No view is registered for “${path}”.`}
          actions={
            <Button size="sm" onClick={() => navigateTo("/")}>
              Return to the landing page
            </Button>
          }
        />
      </div>
    );
  }

  const sub = segments[1] ?? "overview";

  let content: React.ReactNode;
  switch (sub) {
    case "overview":
      content = <OverviewPage />;
      break;
    case "new-analysis":
      content = <NewAnalysisPage />;
      break;
    case "datasets":
      content = <DatasetsPage />;
      break;
    case "runs": {
      const runId = segments[2];
      if (runId) {
        const tab = segments[3] === "report" ? "report" : "overview";
        content = <RunDetailPage runId={runId} initialTab={tab} />;
      } else {
        content = <RunsPage />;
      }
      break;
    }
    case "evidence":
      content = <EvidenceLedgerPage />;
      break;
    case "reports":
      content = <ReportsPage />;
      break;
    case "evaluation":
      content = <EvaluationPage />;
      break;
    case "settings":
      content = <SettingsPage />;
      break;
    default:
      content = <OverviewPage />;
  }

  return <AppShell>{content}</AppShell>;
}
