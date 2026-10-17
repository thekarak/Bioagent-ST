# BioAgent-ST

An evidence-aware, constrained agentic workflow assistant for spatial transcriptomics.

## Repository Structure

```
BioAgent-ST/
├── frontend/       # Next.js 16 + React 19 + Tailwind CSS + shadcn/ui web workspace
└── backend/        # Core agentic workflow engine & analysis service
```

### Frontend (`frontend/`)

The web frontend provides the research-workspace UI, interactive spatial visualization, evaluation protocol dashboard, evidence ledger, and claim classification interface.

- See [frontend/README.md](frontend/README.md) for architecture, tech stack, and local development instructions.
- See [frontend/AGENTS.md](frontend/AGENTS.md) for coding agent guidelines.

### Backend (`backend/`)

The backend engine handles the spatial transcriptomics pipelines, agentic orchestration, and evidence verification.

## License

This project is licensed under the terms of the [LICENSE](LICENSE) file.
