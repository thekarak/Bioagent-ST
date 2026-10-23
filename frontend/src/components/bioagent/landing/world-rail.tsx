"use client";

/**
 * WorldRail — a slim fixed rail (desktop) that maps the persistent 3D
 * world to the page's sections. Each tick is a chapter of the world —
 * Genome, Section, Pipeline, Registry, Orbits, Converge, Field — and
 * clicking a tick scrolls to its section. The active tick tracks the
 * continuous chapter value shared with the WebGL scene, so the rail,
 * the particle formation and the section in view always agree.
 */

import * as React from "react";
import { CHAPTERS, trackWorldInput, worldState } from "./three/world-formations";

function useWorldChapterIndex(): number {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = () => {
      const i = Math.max(0, Math.min(CHAPTERS.length - 1, Math.round(worldState.chapter)));
      if (i !== last) {
        last = i;
        setIdx(i);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return idx;
}

export function WorldRail() {
  const active = useWorldChapterIndex();

  React.useEffect(() => trackWorldInput(), []);

  const scrollTo = (anchor: string) => {
    document
      .getElementById(anchor)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label="Page chapters" className="ba-rail">
      {CHAPTERS.map((c, i) => {
        const isActive = i === active;
        return (
          <button
            key={c.anchor}
            type="button"
            onClick={() => scrollTo(c.anchor)}
            aria-label={`${c.label} — ${c.sub}`}
            aria-current={isActive ? "true" : undefined}
            data-active={isActive ? "true" : "false"}
            className="ba-rail-tick ba-focus group"
          >
            <span className="ba-rail-label" aria-hidden>
              {c.label}
              <span className="ba-rail-sub">{c.sub}</span>
            </span>
            <span className="ba-rail-line" aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
