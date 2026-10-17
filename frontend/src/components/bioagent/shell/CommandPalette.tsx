"use client";

/** Command palette: section navigation + gene search in the loaded dataset. */

import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Play,
  Database,
  History,
  ScrollText,
  FileText,
  LineChart,
  Settings,
  Dna,
  Upload,
} from "lucide-react";
import { APP_ROUTES } from "@/lib/bioagent/router";
import { navigateTo } from "@/lib/bioagent/router";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { useToast } from "@/hooks/use-toast";

const NAV = [
  { label: "Overview", route: APP_ROUTES.overview, icon: LayoutDashboard },
  { label: "New Analysis", route: APP_ROUTES.newAnalysis, icon: Play },
  { label: "Datasets", route: APP_ROUTES.datasets, icon: Database },
  { label: "Runs", route: APP_ROUTES.runs, icon: History },
  { label: "Evidence Ledger", route: APP_ROUTES.evidence, icon: ScrollText },
  { label: "Reports", route: APP_ROUTES.reports, icon: FileText },
  { label: "Evaluation", route: APP_ROUTES.evaluation, icon: LineChart },
  { label: "Settings", route: APP_ROUTES.settings, icon: Settings },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const dataset = useBioAgentStore((s) => s.dataset);
  const loadDataset = useBioAgentStore((s) => s.loadDataset);
  const setPendingGenes = useBioAgentStore((s) => s.setPendingGenes);
  const { toast } = useToast();

  const genes = React.useMemo(() => dataset?.genes ?? [], [dataset]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search sections, actions or genes…" />
      <CommandList className="ba-scroll">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem
              key={n.route}
              value={`navigate ${n.label}`}
              onSelect={() => {
                navigateTo(n.route);
                onOpenChange(false);
              }}
            >
              <n.icon className="size-4" aria-hidden />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Dataset">
          <CommandItem
            value="load demo tissue dataset"
            onSelect={() => {
              loadDataset("ds_demo_tissue_01");
              toast({
                title: "Demo dataset loaded",
                description: "Illustrative synthetic tissue section — not experimental data.",
              });
              onOpenChange(false);
            }}
          >
            <Upload className="size-4" aria-hidden />
            Load demo tissue dataset
          </CommandItem>
        </CommandGroup>
        {genes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Genes in ${dataset?.meta.shortId} (demo identifiers)`}>
              {genes.slice(0, 400).map((g) => (
                <CommandItem
                  key={g.name}
                  value={`gene ${g.name}`}
                  onSelect={() => {
                    setPendingGenes([g.name]);
                    navigateTo(APP_ROUTES.newAnalysis);
                    onOpenChange(false);
                    toast({
                      title: `${g.name} added to a new analysis`,
                      description: "The gene is pre-filled in the gene expression request form.",
                    });
                  }}
                >
                  <Dna className="size-4" aria-hidden />
                  <span className="font-mono text-xs">{g.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    detected in {(g.detectedFraction * 100).toFixed(0)}% of observations
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
