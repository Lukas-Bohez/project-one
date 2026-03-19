# Project-One Integration TODO

## 1. Portfolio integration
- Added portfolio to `frontend/portfolio/` with full Next.js project files.
- Ensure `frontend/portfolio` is exported as a static site (using `output: 'export'` in `next.config.ts`).
- Add link in main site nav (`frontend/index.html`) to `/portfolio/`.

## 2. Deployment path (Apache)
- `frontend/` remains the root served by Apache.
- `frontend/portfolio` can be deployed at `/portfolio/` in the same site.
- Optional direct route with rewrite in `.htaccess`:
  - `/portfolio` → `/portfolio/index.html`
  - SPA fallback to `index.html` in portfolio folder.

## 3. Testing and release
- In `frontend/portfolio`, run:
  - `npm install`
  - `npm run build`
  - `npm run export` (or ensure output `out/` is generated with `output: 'export'`).
- Copy generated static files into Apache target (`/var/www/quizthespire.com/portfolio` or similar).
- Verify link from main page works and renders portfolio site.

## 4. Optional cross-site unification
- Add shared header/footer across top-level `frontend` and `frontend/portfolio`.
- Add root navigation points for:
  - Converter tools
  - Quiz The Spire games
  - Portfolio
  - Support / Sponsor pages
- Add site-level sitemap entries for `/` and `/portfolio/`.

## 5. CI and docs
- Ensure `frontend/portfolio/.github/workflows/ci.yml` is valid. (Existing portfolio CI may be kept as standalone project pipeline.)
- Update `project-one/README.md` to reflect integration, including local dev and deploy instructions.
- Add this TODO file to source control.
