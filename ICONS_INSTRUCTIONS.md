Favicons & icons — generation and deployment

Goal
- Provide small PNG favicons (16x16, 32x32, 48x48, 192x192) in /icons/ and a manifest so Google and modern browsers can easily discover and cache them.

Recommended filenames (place at the web root /icons/):
- /icons/favicon-16x16.png
- /icons/favicon-32x32.png
- /icons/favicon-48x48.png
- /icons/favicon-192x192.png

Quick commands (ImageMagick) to create PNG favicons from the attached image (run on your machine where the image is available):

```bash
# replace source.png with your source image (the one you attached)
convert source.png -resize 16x16 icons/favicon-16x16.png
convert source.png -resize 32x32 icons/favicon-32x32.png
convert source.png -resize 48x48 icons/favicon-48x48.png
convert source.png -resize 192x192 icons/favicon-192x192.png

# If you prefer a single multi-resolution .ico (optional):
convert icons/favicon-16x16.png icons/favicon-32x32.png icons/favicon-48x48.png favicon.ico
```

Deployment steps
1. Upload the PNG files to the server at the paths listed above (most hosting control panels accept an upload into the document root). If your site serves from a subfolder, place into the corresponding /icons/ relative root and update the <link> hrefs.
2. Keep `/favicon.ico` at site root for legacy clients (you already have this). If you regenerate it, replace the root `/favicon.ico` with the new one.
3. Upload `site.webmanifest` to the site root (we added `/site.webmanifest` in the repo).
4. Purge CDN caches if you use a CDN (Cloudflare/Namecheap proxy).
5. In Google Search Console, use URL Inspection for the homepage (and optionally `/favicon.ico`) → Test live URL → Request indexing.

Verification
- Use this URL to check what Google returns once updated:
  https://www.google.com/s2/favicons?domain=quizthespire.com
- Check the page source in a browser to ensure the new `<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png">` tags are present.

Notes
- Keep the PNG files small in bytes; large images can fail Google processing or slow page loads.
- If your hosting root differs from repository layout, upload files to the document root your webserver uses. If you're unsure, drop the files next to the current `/favicon.ico` on the server.
