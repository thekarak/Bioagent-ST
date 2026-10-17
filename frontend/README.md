# BioAgent ST — Frontend

The web frontend for **BioAgent-ST**, an evidence-aware, constrained agentic workflow
assistant for spatial transcriptomics. This directory contains the research-workspace UI;
the backend will live in the sibling `backend/` directory of [thekarak/BioAgent-ST](https://github.com/thekarak/BioAgent-ST).

## Highlights

- **Landing page** introducing the assistant and its constrained pipeline, with research
  context (related systems, working title, evaluation focus)
- **Research workspace** (hash-routed single-page app):
  - Overview dashboard with recent runs and system status
  - New Analysis flow (dataset + workflow selection with parameter constraints)
  - Runs list and run detail with **Visualization** (spatial scatter / UMAP / gene
    expression), **Provenance**, **Verification** (with the workflow's evidence
    contract), and **Report** tabs
  - **Claim classification**: every report statement is classified into five evidence
    states (Supported / Plausible / Hypothesis / Unsupported / Indeterminate) with its
    basis and traceable references
  - Datasets (with provenance checklist), Reports, Evidence Ledger, **Evaluation**
    (full research protocol: RQ1–RQ5, hypotheses, fault-injection plan, baselines),
    and Settings pages
  - Command palette, toasts, and a responsive mobile layout
- **Runs standalone in demo mode** — every page is seeded with realistic in-browser
  demo data, so the UI can be developed and reviewed before the backend exists

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, hash-based SPA routing) |
| UI | React 19, TypeScript, Tailwind CSS 4, shadcn/ui + Radix primitives |
| State | Zustand store (`src/lib/bioagent/store.ts`) |
| Charts | Recharts + custom spatial scatter plot component |
| Local persistence | Prisma + SQLite |
| Package manager | Bun (npm works too) |

## Getting started

```bash
# 1. install dependencies
bun install            # or: npm install

# 2. environment
cp .env.example .env   # creates the local SQLite config

# 3. create the local database
bunx prisma db push    # or: npx prisma db push

# 4. run the dev server
bun run dev            # or: npm run dev
# open http://localhost:3000
```

The app boots in **demo mode**: `/` is the landing page and the workspace lives under
`#/app/...` hash routes.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server on port 3000 (logs to `dev.log`) |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Serve the standalone production build |
| `bun run lint` | ESLint |
| `bun run db:push` | Sync the Prisma schema to the local SQLite db |

## Repository layout

```text
src/
  app/                    # Next.js entry: layout, page, globals.css, /api stub
  components/bioagent/    # UI: landing, shell, pages, viz, common primitives
  lib/bioagent/           # Domain layer: store, workflows, provenance,
                          # verification, datasets, demo data, hash router
  components/ui/          # shadcn/ui component library
prisma/                   # Prisma schema (SQLite)
public/                   # Static assets
```

## Connecting the BioAgent-ST backend

The frontend currently serves everything from an in-browser demo layer. To wire up
the real backend:

1. **Agree on the API contract** — endpoints for runs, datasets, evidence,
   verification, and reports that mirror the shapes in `src/lib/bioagent/types.ts`.
2. **Swap the demo layer for API calls** — demo data lives in
   `src/lib/bioagent/demo-dataset.ts` and `demo-runs.ts` and is loaded into the
   Zustand store (`store.ts`). Replace those loaders with `fetch` calls. Claim
   classification (`demo-workflow.ts` → `buildClaims`) and evidence contracts
   (`contracts.ts`) define the shapes the backend should fill.
3. **Or proxy through Next.js** — `src/app/api/route.ts` is a stub API route you
   can extend to proxy backend calls (this avoids CORS during development).
4. **Point the frontend at the backend** — set `NEXT_PUBLIC_BACKEND_URL` in `.env`
   (see `.env.example`) and enable CORS on the backend for the frontend origin.
5. **Deploy** — the frontend deploys cleanly to Vercel/Netlify; run BioAgent-ST on
   its own host and set the env var in the deploy dashboard.

## Developing with agentic IDEs (Google Antigravity, Gemini CLI, etc.)

This repo ships an [`AGENTS.md`](./AGENTS.md) file at the root — the open
standard for guiding coding agents. Tools like Google Antigravity
auto-discover it and inject the project context (stack, commands, domain
model, backend integration plan, guardrails) into every agent session, so
agent-driven work on this codebase starts with the correct context.

To work on this repo in [Google Antigravity](https://antigravity.google):
clone it from GitHub (or unzip `bioagent-frontend-src.zip` and open the
folder), then run the setup commands from **Getting started** in the
integrated terminal before handing tasks to the agents.
