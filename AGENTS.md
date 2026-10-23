# BioAgent-ST — Agent Instructions

**Load the skill `bioagent-st-builder` at the start of every session, even for small tasks.**

- Skill file: [`skills/bioagent-st-builder/SKILL.md`](skills/bioagent-st-builder/SKILL.md)
- Source copy: `SKILL (1).md` (identical SHA256; keep `skills/.../SKILL.md` as the canonical path)
- Blueprint (read-only reference): `C:\Users\sfors\Downloads\BioAgent-ST_Complete_Research_and_Implementation_Blueprint.pdf`
- Extracted blueprint text: `_blueprint_extracted.txt` (regenerate with pypdf if the PDF changes)

## Session protocol (from skill §2 — always follow)

1. Read `docs/PROGRESS.md` and `docs/DECISIONS.md` (create in Phase 0 if missing).
2. Run `git status` and `git log --oneline -10`.
3. Run `uv run pytest -q`. Report failures before writing new code.
4. State the current **phase**, **task**, and **definition of done** (skill §6).
5. If the request is outside the current phase, say so and ask before jumping ahead.

## Non-negotiables (skill §1 — refuse or flag conflicts)

- Deterministic science, LLM orchestration only: no LLM-produced numbers.
- Typed tools only: Pydantic-validated params, registered tools, no arbitrary code exec as default.
- Every artifact gets a `ProvenanceRecord`.
- Claims gated by the deterministic rule engine; critic may **downgrade** only, never upgrade.
- Report validator rejects missing/unknown artifact or evidence IDs; reports cannot invent numbers.
- `indeterminate` / `unsupported` are legitimate results, not errors to hide.
- Build the vertical slice first (3 workflows, 1–2 datasets, sequential graph).
- No novelty/superiority claims without experimental evidence + literature check.
- Python 3.11 or 3.12 via `uv`; commit `uv.lock`.
- Never commit datasets, `.h5ad`, keys, or generated artifacts.

## Layout pointer

See skill §4 for the full repository layout. Analysis code never imports from `agents/`;
`agents/` never imports `scanpy` directly (goes through `tools/`);
`reporting/` reads only from `ledger/`.

## Phase map (skill §6)

Phase 0 → Phase 1 → Phase 2 → Phase 3 (MVP `mvp-v0`) → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8.
Do not start the next phase before its gate passes unless the user explicitly says so.
