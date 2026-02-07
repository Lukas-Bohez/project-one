# Frontend Map

This folder is served by Apache as the web root. Paths are preserved to avoid breaking production URLs.

## High-Level Layout

- index.html and other root files (ads.txt, robots.txt, sitemap.xml, site verification)
- pages/ - app pages (one folder per page)
- css/ - shared stylesheets and css/pages per-page styles
- js/ - shared scripts and js/pages per-page scripts
- images/, svg/, lofi/ - assets
- articles/ - article system (pages, posts, images, scripts)
- idleGame/ - standalone game bundle

## Root Files

See [ROOT_FILES.md](ROOT_FILES.md) for the list of web-root files that must stay in place.

## Folder Readmes

- [pages/README.md](pages/README.md)
- [css/README.md](css/README.md)
- [css/pages/README.md](css/pages/README.md)
- [js/README.md](js/README.md)
- [js/pages/README.md](js/pages/README.md)
- [articles/README.md](articles/README.md)
- [idleGame/README.md](idleGame/README.md)
- [images/README.md](images/README.md)
- [svg/README.md](svg/README.md)
- [lofi/README.md](lofi/README.md)
- [downloads/README.md](downloads/README.md)
- [exampleStories/README.md](exampleStories/README.md)
- [cert/README.md](cert/README.md)
- [posts/README.md](posts/README.md)

## Notes

- Keep existing paths stable unless all references are updated.
- If new sections are added, consider documenting them here for discoverability.
