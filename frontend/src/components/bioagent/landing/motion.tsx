"use client";

/**
 * Motion primitives for the landing page: reveal-on-scroll, scroll progress,
 * scroll-spy, eased count-up and back-to-top. Everything is dependency-free
 * (IntersectionObserver + CSS transitions) and honors prefers-reduced-motion.
 */

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- reduced motion ---------- */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ---------- reveal on scroll ---------- */

export function useReveal<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const nodeRef = React.useRef<T | null>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [nodeRef, visible];
}

type RevealTag = "div" | "li" | "article" | "ul";

/** Wraps content in a scroll-triggered reveal. CSS handles the animation. */
export function Reveal({
  as = "div",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: RevealTag;
  delay?: number;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const [nodeRef, visible] = useReveal<HTMLElement>();
  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        nodeRef.current = node;
      }}
      className={cn("ba-reveal", className)}
      data-visible={visible ? "true" : "false"}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ---------- eased count-up ---------- */

export function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [value, setValue] = React.useState(target);
  const reduced = usePrefersReducedMotion();
  React.useEffect(() => {
    if (!active) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration, reduced]);
  return value;
}

/* ---------- page scroll progress (0..1) ---------- */

export function useScrollProgress(): number {
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    let queued = false;
    const update = () => {
      queued = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);
    };
    const onScroll = () => {
      if (!queued) {
        queued = true;
        raf = requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return progress;
}

/* ---------- nav scroll spy ---------- */

/** Active section = the last section whose top passed the probe line
 *  (35% of the viewport height). Robust for sections of any height. */
export function useScrollSpy(ids: readonly string[], defaultId: string): string {
  const [active, setActive] = React.useState(defaultId);
  React.useEffect(() => {
    let raf = 0;
    let queued = false;
    const update = () => {
      queued = false;
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - doc.clientHeight;
      // At (or near) the bottom, highlight the final section.
      if (maxScroll > 0 && window.scrollY >= maxScroll - 60) {
        const last = ids[ids.length - 1] ?? defaultId;
        setActive(last);
        return;
      }
      const probe = window.scrollY + window.innerHeight * 0.35;
      let current = defaultId;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top + window.scrollY <= probe) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!queued) {
        queued = true;
        raf = requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ids, defaultId]);
  return active;
}

/* ---------- back to top ---------- */

export function BackToTop() {
  const [show, setShow] = React.useState(false);
  const reduced = usePrefersReducedMotion();
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}
      className={cn(
        "ba-focus fixed bottom-5 right-5 z-40 flex size-10 items-center justify-center rounded-full border border-[var(--ba-border)] bg-[var(--ba-bg)] text-[var(--ba-ink)] shadow-[0_2px_12px_var(--ba-shadow-c)] transition-all duration-300 hover:border-[var(--ba-ink-soft)]",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-4" aria-hidden />
    </button>
  );
}
