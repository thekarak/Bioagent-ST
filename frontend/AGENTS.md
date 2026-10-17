# AGENTS.md — BioAgent-ST Frontend

Instructions for AI coding agents (Google Antigravity, Gemini CLI, and other
AGENTS.md-compatible tools) working in this repository. Read this before
making changes.

## Project context

- This is the **frontend** of BioAgent-ST, an evidence-aware, constrained
  agentic workflow assistant for spatial transcriptomics. It is part of a
  **research paper project** — the UI must stay aligned with the paper's
  concepts (see "Domain model" below).
- The backend is developed separately at
  https://github.com/thekarak/BioAgent-ST. **This repo currently runs fully
  in demo mode** — all data is deterministically generated in the browser
  (`src/lib/bioagent/demo-*.ts`). Backend integration is the main upcoming
  work.
- The app boots as a landing page at `/` and a hash-routed SPA workspace at
  `/#/app/...`.

## Domain model (paper-aligned — do not break these semantics)

- **Five evidence states** for report claims: `Supported`, `Plausible`,
  `Hypothesis`, `Unsupported`, `Indeterminate`. Claims are built in
  `src/lib/bioagent/demo-workflow.ts` (`buildClaims`) — a claim may only be
  `Supported` when its referenced checks actually passed.
- **Evidence contracts** (`src/lib/bioagent/contracts.ts`): machine-readable
  per-workflow contracts rendered on the run Verification tab.
- **Evaluation protocol** (`src/components/bioagent/pages/EvaluationPage.tsx`):
  RQ1–RQ5, hypotheses H1–H4, 8-category fault-injection matrix, baselines,
  leakage discipline. Measured results are intentionally empty — keep the
  honest empty state; only a demo preview toggle exists.
- **Dataset provenance checklist**: license / accession / downloadedAt /
  checksum fields on `DatasetMeta` (`src/lib/bioagent/types.ts`). Demo data
  honestly shows "Not recorded" / synthetic labels — never fake provenance.

## Stack

Next.js 16 (App Router, hash-based SPA) · React 19 · TypeScript (strict) ·
Tailwind CSS 4 · shadcn/ui + Radix primitives · Zustand
(`src/lib/bioagent/store.ts`) · Recharts + custom SVG spatial scatter ·
Prisma + SQLite (dev only) · Bun package manager.

## Setup & commands

```bash
bun install             # or npm install
cp .env.example .env    # local SQLite config (never commit .env)
bunx prisma db push     # create the local database
bun run dev             # http://localhost:3000
```

Definition of done for any change: `bun run lint` clean,
`bunx tsc --noEmit` clean (no new src errors), dev server renders without
console/hydration errors, and the change works at 390px width (mobile).

## Repo map

| Path | Role |
| --- | --- |
| `src/lib/bioagent/types.ts` | Data contract — single source of truth shared with the backend |
| `src/lib/bioagent/store.ts` | Zustand store; loads demo data; hydration normalizes older persisted runs |
| `src/lib/bioagent/demo-dataset.ts`, `demo-runs.ts`, `demo-workflow.ts` | Demo data + deterministic run/claim generation (replace with API calls) |
| `src/lib/bioagent/contracts.ts` | Evidence contracts per workflow |
| `src/lib/bioagent/hash-router.ts` | Hash-based SPA routing |
| `src/components/bioagent/landing/` | Landing page sections (research context, evidence states) |
| `src/components/bioagent/pages/` | Workspace pages (Overview, Runs, RunDetail tabs, Datasets, Reports, Evidence, Evaluation, Settings) |
| `src/components/bioagent/viz/` | Spatial scatter plot (SVG, zoom/pan, hover/selection, exports) |
| `src/app/api/route.ts` | Stub API route — extendable into a backend proxy (avoids CORS) |
| `prisma/schema.prisma` | Local persistence schema |

## Backend integration plan (the main "further steps")

1. **API contract**: endpoints for runs, datasets, evidence, verification,
   reports should mirror the shapes in `src/lib/bioagent/types.ts`.
2. **Swap the demo layer**: replace the demo loaders inside the Zustand store
   with `fetch` calls to the backend; keep the store's public API stable so
   pages don't change.
3. **Or proxy via Next.js**: extend `src/app/api/route.ts` to forward requests
   (avoids CORS without touching backend).
4. **Configuration**: `NEXT_PUBLIC_BACKEND_URL` in `.env` selects the backend;
   unset = demo mode. Keep demo mode working as a fallback.
5. **Deploy**: frontend on Vercel/Netlify; backend on its own host.

Good first tasks: a typed API client (`src/lib/bioagent/api.ts`) generated
from `types.ts`; wire the New Analysis flow to `POST /runs`; stream live
stage progression; real evaluation records once the backend runs experiments.

## Conventions & guardrails

- TypeScript strict; avoid `any` and new dependencies — prefer existing
  shadcn/ui components and Radix primitives.
- Keep demo data deterministic and clearly labeled (Demo Mode indicator,
  synthetic tags). Never present synthetic data as measured results.
- Do not commit `.env`, `db/`, `download/`, `skills/`, `worklog.md`, or
  verification screenshots (see `.gitignore`).
- Preserve the honest-empty evaluation state and provenance "Not recorded"
  behavior unless real backend data is wired in.
- All user-facing text in English; keep terminology consistent with the
  paper (evidence states, evidence contract, claim classification).
