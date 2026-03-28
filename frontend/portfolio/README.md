# Lukas Bohez - Full-Stack Software Engineer

Welcome to the personal portfolio and self-hosted lab of Lukas Bohez. I specialize in Python backend systems, Dart/Flutter cross-platform frontend, and high-performance media engineering.

## About Me

- Name: Lukas Bohez
- Role: Full-Stack Software Engineer
- Focus: Python, FastAPI, Dart/Flutter, Linux infrastructure, Raspberry Pi 5
- Media Engineering: yt-dlp, FFmpeg, youtube_explode_dart, native stream/conversion workflows
- Infrastructure: Docker, Apache2, self-hosted server labs, 24/7 production operations
- Database: MySQL, SQLite, JSON state management
- Languages: Python (expert), Dart/Flutter (advanced), JavaScript/TypeScript, HTML/CSS, C++ (Arduino)

## Technical Expertise

- Backend: FastAPI, Docker, Apache2, Linux server administration, web automation, scalable self-hosted architectures.
- Frontend: Flutter cross-platform apps, responsive UI/UX with modern web techniques.
- Media systems: real-time streaming metadata processing, batch conversions, privacy-first workflows.
- CI/CD & quality: ESLint, Prettier, GitHub Actions, safe deployment pipelines.

## Key Projects

- **ConvertTheSpire**: native Flutter media engine for fast local stream handling and bulk conversion.
- **QuizTheSpire.com**: Python backend + Apache frontend toolchain for playlist MP3/MP4 throughput.
- **SportScore!**: collaborative JavaScript team app.
- **Howest school assignments**: academic projects (e.g. `opdracht-1-howest`) from Hogeschool West-Vlaanderen.

## Personal Interests

- Learning Japanese with an emphasis on linguistic logic and cross-cultural design thinking.
- Strategic gaming and manga (Ragna Crimson) to inform complex system architecture.
- Digital content strategy and professional video editing.

## Portfolio Overview

This repository includes:

- Professional portfolio website built with Next.js App Router
- TailwindCSS-based design system
- ESLint + Prettier integration for consistent code quality
- GitHub Actions CI for lint, formatting check, and production build validation

## CMS Research

### Comparison Table

| CMS            | Type                 | Free tier                      | Next.js integration                          | Best for portfolio?                                  |
| -------------- | -------------------- | ------------------------------ | -------------------------------------------- | ---------------------------------------------------- |
| **Sanity**     | Headless SaaS        | Yes — unlimited projects, 10GB | Excellent (official SDK, GROQ, live preview) | Yes — best docs, real-time, GROQ is powerful         |
| **Keystatic**  | File-based / Git     | Fully free (no account)        | Good (official Next.js adapter)              | Yes — zero cost, content in repo, good for solo devs |
| **Contentful** | Headless SaaS        | Yes — 25k API calls/month      | Excellent (official SDK, TypeScript types)   | Yes — enterprise-grade but free tier is limited      |
| **Strapi**     | Self-hosted headless | Free (self-hosted)             | Good (REST + GraphQL)                        | Possible — requires server, overkill for portfolio   |
| **@next/mdx**  | Markdown/local       | Fully free                     | Native (built into Next.js)                  | Good for blogs, not ideal for structured data        |

### Chosen CMS: Sanity

**Why Sanity:**

- Free tier is genuinely unlimited for a portfolio (no API call caps that matter at this scale)
- GROQ query language is more powerful than GraphQL for selective field fetching
- Official Next.js integration with TypeScript support out of the box
- Real-time collaborative editing (useful if you ever add a collaborator)
- Sanity Studio (the editing UI) can be embedded directly in the Next.js app at `/studio`

**Caching strategy:** ISR with `revalidate: 3600` for projects (changes rarely) and `revalidate: 86400` for about content (changes almost never). This gives static-site performance while still allowing CMS updates to propagate within an hour without redeploying.

Additional docs:

- [PROJECTS.md](./PROJECTS.md) — detailed project architecture and highlights
- [CONTRIBUTIONS.md](./CONTRIBUTIONS.md) — community and open-source collaboration strategy

## Quick Start

Run the following commands to start development locally:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` - start Next.js development server
- `npm run build` - build production app
- `npm run start` - run production build locally
- `npm run lint` - run ESLint checks
- `npm run format` - format source with Prettier
- `npm run format:check` - verify formatting
- `npm test` - lint + build

## Connect

- GitHub: [github.com/Lukas-Bohez](https://github.com/Lukas-Bohez)
- Sponsors: [github.com/sponsors/Lukas-Bohez](https://github.com/sponsors/Lukas-Bohez)
- Support: [buymeacoffee.com/OrokaConner](https://buymeacoffee.com/OrokaConner)
- Personal tool: [quizthespire.com](https://quizthespire.com)
- LinkedIn: [linkedin.com/in/lukas-bohez](https://www.linkedin.com/in/lukas-bohez)
- Email: lukasbohez@gmail.com

## Featured Repositories

- [ConvertTheSpireFlutter](https://github.com/Lukas-Bohez/ConvertTheSpireFlutter)
- [QuizTheSpire](https://github.com/Lukas-Bohez/QuizTheSpire)
- [opdracht-1-howest](https://github.com/Lukas-Bohez/opdracht-1-howest)
- [mct-interaction-design/view-transition-intro-Lukas-Bohez](https://github.com/Lukas-Bohez/mct-interaction-design/tree/main/view-transition-intro-Lukas-Bohez)

## Deploy

### Option 1: Static export (Apache friendly)

1. Build and export static files:
   ```bash
   npm run build
   npm run export
   ```
2. This generates an `out` directory with an `index.html` and static asset tree.
3. Copy `out/` into your Apache docroot (e.g., `/var/www/quizthespire.com/`).
4. Ensure `DirectoryIndex index.html` is set, and (optionally) add this in `.htaccess`:
   ```apache
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^(.*)$ /index.html [L,QSA]
   ```
5. Visit your site at `https://quizthespire.com`.

### Option 2: Next.js server reverse proxy

If you prefer dynamic mode, run `npm run start` on a node server and reverse proxy through Apache:

```apache
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
```

---

Deploy safely to Vercel or any Next.js compatible hosting. CI automatically validates each commit.

---

Thank you for visiting my portfolio codebase. Feedback is welcome!

## Updated About Me (Added by AI sync)

- AI setup: repository synchronized with https://github.com/Lukas-Bohez/lbohez-portfolio
- Latest skills: added notes about full-stack Next.js portfolio + static export deployment.
- Personal intent: maintain accessible open-source self-hosted tools and media pipelines.
