"use client";

/** Workspace settings: visualization defaults, interface and honest build info. */

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Info, MonitorCog } from "lucide-react";
import { useBioAgentStore } from "@/lib/bioagent/store";
import { SectionHeading, Kbd, InfoRow, MonoId } from "@/components/bioagent/common/primitives";

export function SettingsPage() {
  const settings = useBioAgentStore((s) => s.settings);
  const setSettings = useBioAgentStore((s) => s.setSettings);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Workspace preferences for visualization and interface behavior. Settings apply to newly
          opened plots.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="viz-settings">
        <SectionHeading
          id="viz-settings"
          title="Visualization defaults"
          description="Default point rendering for spatial and embedding plots. Controls remain adjustable per plot."
        />
        <div className="mt-4 grid gap-5 sm:max-w-md">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="default-size">Point size</Label>
              <span className="font-mono text-xs text-muted-foreground">{settings.pointSize.toFixed(1)}</span>
            </div>
            <Slider
              id="default-size"
              min={1}
              max={7}
              step={0.2}
              value={[settings.pointSize]}
              onValueChange={(v) => setSettings({ pointSize: v[0] })}
              aria-label="Default point size"
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="default-opacity">Opacity</Label>
              <span className="font-mono text-xs text-muted-foreground">{Math.round(settings.opacity * 100)}%</span>
            </div>
            <Slider
              id="default-opacity"
              min={0.2}
              max={1}
              step={0.05}
              value={[settings.opacity]}
              onValueChange={(v) => setSettings({ opacity: v[0] })}
              aria-label="Default point opacity"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-secondary/40 p-3">
            <div>
              <Label htmlFor="cb-safe" className="text-sm">
                Colorblind-conscious categorical palette
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cluster colors use an Okabe-Ito derived palette. This is the only palette shipped,
                so the setting is always on.
              </p>
            </div>
            <Switch id="cb-safe" checked={settings.colorblindSafe} disabled aria-label="Colorblind-conscious palette (always on)" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="interface-settings">
        <SectionHeading id="interface-settings" title="Interface" />
        <dl className="mt-3 divide-y divide-border border-t border-border">
          <InfoRow
            label="Command palette"
            value={
              <span className="flex items-center gap-2">
                <Kbd>Ctrl</Kbd> <span className="text-muted-foreground">or</span> <Kbd>⌘ K</Kbd>
                <span className="text-muted-foreground">— navigate sections and search genes</span>
              </span>
            }
          />
          <InfoRow
            label="Tooltips"
            value="Plot tooltips complement — never replace — visible legends and tables."
          />
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="about-settings">
        <SectionHeading id="about-settings" title="About this build" />
        <dl className="mt-3 divide-y divide-border border-t border-border">
          <InfoRow label="Application" value="BioAgent-ST research prototype (frontend)" />
          <InfoRow label="Frontend version" value={<MonoId value="frontend-demo-0.1.0" copy={false} />} mono />
          <InfoRow label="Demo adapter" value="Local, in-browser, clearly labeled — isolated from future backend services" />
          <InfoRow
            label="Scientific backend"
            value={
              <span className="flex items-start gap-2 text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Not connected. Scanpy/Squidpy execution, dataset parsing and evaluation records
                require the backend; the interface reports their absence instead of simulating
                success.
              </span>
            }
          />
          <InfoRow label="Data storage" value="Session only — no data leaves this browser" />
        </dl>
      </section>
    </div>
  );
}
