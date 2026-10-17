"use client";

/**
 * Lightweight hash-based router.
 *
 * The deployable preview in this environment exposes a single Next.js route
 * ("/"), so the landing page and the research dashboard are addressed with
 * hash segments: "#/" (landing) and "#/app/…" (workspace). Navigation,
 * active states, back/forward and deep links all work through this router.
 */

import { useCallback, useEffect, useState } from "react";

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

export function useHashRouter() {
  const [path, setPath] = useState<string>(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    if (currentPath() === target) return;
    window.location.hash = `#${target}`;
  }, []);

  return { path, segments: path.split("/").filter(Boolean), navigate };
}

export function navigateTo(to: string) {
  const target = to.startsWith("/") ? to : `/${to}`;
  if (typeof window !== "undefined") {
    if (currentPath() === target) return;
    window.location.hash = `#${target}`;
  }
}

export function isRouteActive(path: string, prefix: string): boolean {
  if (prefix === "/") return path === "/";
  return path === prefix || path.startsWith(`${prefix}/`);
}

export const LANDING_ROUTE = "/";
export const APP_BASE = "/app";

export const APP_ROUTES = {
  overview: "/app/overview",
  newAnalysis: "/app/new-analysis",
  datasets: "/app/datasets",
  runs: "/app/runs",
  run: (id: string) => `/app/runs/${id}`,
  evidence: "/app/evidence",
  reports: "/app/reports",
  report: (id: string) => `/app/runs/${id}/report`,
  evaluation: "/app/evaluation",
  settings: "/app/settings",
} as const;
