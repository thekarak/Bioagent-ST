"use client";

/**
 * Landing-page theme system — deliberately scoped to the landing tree.
 *
 * A `ba-dark` class on the landing root (`.ba-landing`) flips the scoped
 * CSS token layer in globals.css; the workspace at `/#/app/...` keeps its
 * own theme and is never affected. The choice persists in localStorage and
 * is applied before first paint by a tiny inline script rendered at the top
 * of the landing root, so dark mode never flashes white on reload.
 *
 * `useLandingTheme` is a tiny external store (useSyncExternalStore): WebGL
 * scenes subscribe to it to re-tune materials per theme without React state
 * churn inside the render loop.
 */

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingTheme = "light" | "dark";

const STORAGE_KEY = "ba-theme";

let current: LandingTheme | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): LandingTheme {
  if (current === null) {
    current =
      typeof document !== "undefined" &&
      document.getElementById("top")?.classList.contains("ba-dark")
        ? "dark"
        : "light";
  }
  return current;
}

function setLandingTheme(theme: LandingTheme): void {
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode — theme simply won't persist */
  }
  if (typeof document !== "undefined") {
    document
      .getElementById("top")
      ?.classList.toggle("ba-dark", theme === "dark");
  }
  listeners.forEach((l) => l());
}

/** Reads (and subscribes to) the landing theme. SSR renders as light. */
export function useLandingTheme(): {
  theme: LandingTheme;
  isDark: boolean;
  toggleTheme: () => void;
} {
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "light" as LandingTheme,
  );
  return {
    theme,
    isDark: theme === "dark",
    toggleTheme: () => setLandingTheme(theme === "dark" ? "light" : "dark"),
  };
}

/** Nav sun/moon toggle. Renders the moon in light mode (click -> dark). */
export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggleTheme } = useLandingTheme();
  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to the light theme" : "Switch to the dark theme"}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className={cn(
        "ba-focus flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--ba-border)] bg-[var(--ba-bg)] text-[var(--ba-muted)] transition-colors duration-200 hover:border-[var(--ba-ink-soft)] hover:text-[var(--ba-ink)]",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
