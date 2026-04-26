# Lukas Bohez — Full-Stack Software Engineer & Project One

Welcome to my personal portfolio codebase and the self-hosted lab behind Quiz The Spire. I specialize in Python backend systems, TypeScript/Next.js frontend, and full-stack media engineering.

## About Me

- Name: Lukas Bohez
- Role: Full-Stack Software Engineer
- Focus: Python, FastAPI, TypeScript/Next.js, Linux infrastructure, self-hosted operations
- Media Engineering: yt-dlp, FFmpeg, native stream/conversion workflows
- Infrastructure: Docker, Apache2, self-hosted server labs, 24/7 production deployment
- Database: MySQL, SQLite, JSON state management
- Languages: Python (expert), TypeScript/JavaScript (advanced), Dart/Flutter, HTML/CSS, C++

## Technical Expertise

- **Backend**: FastAPI, Docker, Apache2, Linux administration, web automation, scalable architectures
- **Frontend**: Next.js 16 App Router, TailwindCSS 4, responsive design, server-side rendering, static export
- **Media systems**: real-time metadata processing, batch conversions, privacy-first workflows
- **CI/CD & Quality**: ESLint, Prettier, GitHub Actions, safe deployment pipelines

## Key Projects

- **Quiz The Spire** (quizthespire.com): Python/FastAPI backend + Next.js frontend for interactive quiz platform
- **Idle Game**: TypeScript/vanilla JS incremental game with rebirth system and Sanity CMS integration
- **Portfolio** (quizthespire.com/LukasBohez): Next.js 16 with route groups, modal interception, Suspense streaming
- **SENTLE**: Daily word puzzle game with UTC-based streak persistence and leaderboards
- **Manage The Spire**: Playlist management and media conversion platform

## Repository Structure

- `frontend/` — Apache web root and static site assets
  - `frontend/portfolio/` — Next.js portfolio (Lukas Bohez) — Lighthouse 97/100
  - `frontend/idleGame/` — Interactive idle game with rebirth mechanics
  - `frontend/js/` — Vanilla JS systems (SENTLE, adblock detection, etc.)
- `backend/` — FastAPI services, WebSocket server, APIs
- `docs/` — Consolidated documentation
- `scripts/` — Automation and operational scripts
- `configs/` — Server and service configurations
- `data/` — Database models and dumps

## Recent Improvements (4-Phase Mega Pass)

### Phase 1: Portfolio Polish ✅
- Design tokens audit and implementation (CSS variables)
- Compound Gallery component with React Context
- Custom `useSanityLivePreview<T>` hook for dev polling
- Responsive HeroPortrait with art direction (3 breakpoint variants)
- **Lighthouse Result**: Performance 97 / Accessibility 100 / Best Practices 96 / SEO 100

### Phase 2: Idle Game Hardening ✅
- Rebirth milestone notifications (1, 5, 10, 25, 50, 100)
- Event timing reset audit (lastEventTime, activeEvent, eventEndTime)
- Auto-save integrity verification (SaveManager._isResetting flag)
- Arcade state cleanup (activeGame, gameStartTime reset)
- MarketSystem state sync post-rebirth

### Phase 3: Main Site Improvements ✅
- Adblock detection with first-party fallback (Promise.all detection)
- SENTLE streak persistence using UTC seed (cross-device consistency)
- Main site Lighthouse audit (Performance 28 → optimization track)

### Phase 4: Housekeeping ✅
- Enhanced `.gitignore` (audit reports, env files, certificates)
- README consolidation and markdown finalization
- Git history review and secret scan (no exposed credentials)

## Setup

1. Clone the repository
2. Install dependencies: `npm install` (frontend) and `pip install -r requirements.txt` (backend)
3. Create `.env.local` from `.env.example`
4. Start development: `npm run dev` (frontend) and `python -m uvicorn app:app --reload` (backend)

## Deployment

### Portfolio Static Export
```bash
npm run build          # Compile with Next.js 16 Turbopack
npm run update:portfolio  # Deploy to Apache + verify live URL
npx lighthouse https://quizthespire.com/LukasBohez/ --output=json
```

### Main Site
Apache docroot: `/home/student/Project/project-one/frontend/`

## Quality Checks

- `npm run lint` — ESLint with --max-warnings=0
- `npm run format:check` — Verify Prettier formatting
- `npm run build` — Production build validation
- Backend: `pytest`, flake8 (audit available in flake_report*.txt)

## Documentation

- [PROJECTS.md](./PROJECTS.md) — detailed project architecture
- [CONTRIBUTIONS.md](./CONTRIBUTIONS.md) — collaboration strategy
- [docs/README.md](docs/README.md) — full documentation index
- [Portfolio/DEPLOYMENT.md](frontend/portfolio/DEPLOYMENT.md) — deployment flow

## Connect

- GitHub: [github.com/Lukas-Bohez](https://github.com/Lukas-Bohez)
- Portfolio: [quizthespire.com/LukasBohez](https://quizthespire.com/LukasBohez)
- LinkedIn: [linkedin.com/in/lukas-bohez](https://www.linkedin.com/in/lukas-bohez)
- Email: lukas@quizthespire.com

---

Thank you for exploring my work. Feedback and collaboration inquiries are always welcome!
