# Project One

This repository is a multi-part project with a static frontend, backend services, and supporting tools. The goal of this index is to make navigation obvious without changing any runtime paths.

## Primary Areas

- frontend/ - Apache web root and static site assets
  - frontend/portfolio/ - Next.js portfolio project (Lukas Bohez)
- backend/ - FastAPI backend and data integrations
- docs/ - Consolidated documentation (project, manage, demo, sentle, shared)
- scripts/ - Automation and operational scripts
- configs/ - Server and service configs
- data/ - Database models and dumps
- logs/ - Log outputs
- ux/, figma/, fritzing/ - Design and hardware assets

## Documentation

- [docs/README.md](docs/README.md) - Full documentation map
- [docs/manage/README.md](docs/manage/README.md) - Manage the Spire docs
- [docs/demo/README.md](docs/demo/README.md) - Demo docs
- [docs/sentle/README.md](docs/sentle/README.md) - Sentle docs
- [docs/shared/README.md](docs/shared/README.md) - Shared guides

## Scripts

- [scripts/README.md](scripts/README.md) - Scripts index
- [scripts/ops](scripts/ops) - Ops scripts (root shims remain for compatibility)

## Notes

- Apache serves frontend/ as the web root, so paths in that folder are kept stable.
- Root shell scripts remain as shims for backward compatibility.
