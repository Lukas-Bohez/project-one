---

Here are the most important fixes for the website repo, in priority order:

---

## 🔴 Critical — Fix Immediately

**1. Private TLS key committed to the public repo**

`frontend/cert/key.pem` contains a **real private key** that is publicly visible to anyone who visits the GitHub repository. Even if it's a self-signed localhost cert, this is bad practice and needs to go immediately.

- Remove the file from git: `git rm --cached frontend/cert/key.pem frontend/cert/cert.pem`
- Add to `.gitignore`: `frontend/cert/*.pem`
- Rotate the key/cert if it was ever used on a real server
- Force-push to scrub git history: `git filter-repo --path frontend/cert/key.pem --invert-paths`

**2. Hardcoded admin password in `backend/app.py` (lines 12315 & 12628)**

```python
SENTLE_ADMIN_PASSWORD = os.getenv("SENTLE_ADMIN_PASSWORD", "sentle6967god")
```
This fallback default password `"sentle6967god"` is now publicly visible on GitHub. Anyone can see it. Fix by removing the default entirely — require the environment variable to be set:
```python
SENTLE_ADMIN_PASSWORD = os.getenv("SENTLE_ADMIN_PASSWORD")
if not SENTLE_ADMIN_PASSWORD:
    raise RuntimeError("SENTLE_ADMIN_PASSWORD environment variable must be set")
```

---

## 🟠 High — Security Headers

**3. Missing `Content-Security-Policy` header**

The Apache config sets HSTS, `X-Frame-Options`, and `X-Content-Type-Options`, but there is **no CSP header**. This leaves the site open to XSS injection. Add to the Apache vhost:
```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.socket.io https://cdnjs.cloudflare.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' wss://quizthespire.com; img-src 'self' data: https:; frame-ancestors 'self'"
```

**4. Missing `Permissions-Policy` header**

Add to Apache config:
```apache
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
```

**5. `frontend/.htaccess` sets `Access-Control-Allow-Origin: *`**

This wildcard CORS header on all static files contradicts the more restrictive header set in the Apache vhost, and could be exploited if the vhost header doesn't always win. Change the `.htaccess` to:
```apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "https://quizthespire.com"
    Header set Access-Control-Allow-Methods "GET"
</IfModule>
```

---

## 🟡 Medium — Bugs & Quality

**6. `robots.txt` and `sitemap.xml` are concatenated into a single file**

Looking at `robots.txt`, the XML from `sitemap.xml` runs on directly after the robots rules with no newline or separator. This means `robots.txt` is malformed — crawlers will fail to parse it. The two files need to be separate. Check your build/deployment process that isn't accidentally concatenating them.

**7. Admin pages are not blocked by `robots.txt`**

`/pages/admin/` is accessible and not listed in `Disallow`. Add:
```
Disallow: /pages/admin/
Disallow: /pages/sentle-admin/
Disallow: /pages/login/
```

**8. `console.log` statements in production JS**

`main.js` has 38 `console.log` calls including ones that log socket transport details and connection info. These leak implementation details in the browser console. Strip them for production, or gate them behind a `DEBUG` flag:
```js
const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);
```

**9. `sitemap.xml` has stale `lastmod` dates**

All entries show `2025-10-23` regardless of when pages were actually updated. Search engines use this to prioritise crawling. Update `lastmod` to accurate dates, or generate the sitemap automatically as part of your deployment.

---

## 🟢 Low — Polish & SEO

**10. `<meta name="description">` on the homepage contains version-specific app release notes**

The description tag currently reads *"Download Convert The Spire Reborn (v5.1.3) — improved yt-dlp handling, better browser..."*. Meta descriptions should be stable, evergreen copy — not release notes. Version numbers in descriptions also look bad in Google search results and require updating every release. Move the changelog to the page body.

**11. `X-Forwarded-For` header is set to the actual remote address by Apache but not validated by the backend**

In the Apache config:
```apache
RequestHeader set X-Forwarded-For "expr=%{REMOTE_ADDR}"
```
This correctly sets the real IP, but if your backend rate-limiting reads `X-Forwarded-For` directly from the request header rather than using the value Apache set, a user could spoof it by sending their own `X-Forwarded-For` before Apache's rewrite. Verify that `get_remote_address` in slowapi reads the address Apache injects, not a user-controlled header.

**12. `.DS_Store` file committed to the repo**

`frontend/.DS_Store` is a macOS metadata file that should never be in a public repo — it can leak directory structure. Add to `.gitignore`:
```
**/.DS_Store
```
And remove from git: `git rm --cached frontend/.DS_Store`

**13. `.bak` backup files are in the web root**

`frontend/css/pages/support/support.css.bak` and `frontend/pages/support/index.html.bak` are directly served by Apache if requested. Backup files should never sit in the web root. Remove them or add to `.htaccess`:
```apache
<FilesMatch "\.bak$">
    Require all denied
</FilesMatch>
```

Let me do a thorough audit of all remaining files in the repo.---

## Additional Issues Found

**14. CSRF protection is declared but not implemented**

The login form has `<input type="hidden" id="csrfToken" name="_csrf" value="">` but the token field is always empty — no JS populates it and no backend endpoint validates it. This means POST requests from any origin are accepted. The docs even note it as a pending TODO (`"Add CSRF protection for form submissions"`). Fix by generating a token server-side, setting it in a cookie, and requiring it to match on all state-changing POST requests.

**15. `content.js` renders article data without escaping**

`buildArticleHTML()` in `content.js` interpolates `article.title`, `article.intro`, `highlight.title`, `highlight.content`, `card.title`, `card.content`, `section.title`, `section.content`, and list items all directly into template literal HTML with no `escapeHTML()` call. While the article data is currently hardcoded in the file, this is a latent XSS vulnerability if the data ever comes from an API or admin interface. The newer `content-new.js` correctly uses `escapeHTML()` — apply the same pattern to `content.js`:
```js
<h2>${escapeHTML(article.title)}</h2>
<p>${escapeHTML(article.intro)}</p>
```

**16. `sitemap.xml` is missing the quiz, lofi-download, and download pages**

Several key user-facing pages are absent from `sitemap.xml`: `/pages/quiz/`, `/pages/lofi-download/`, `/pages/conversion/`, and `/pages/spire-ai/`. These are the main product pages and missing them hurts SEO.

**17. AdSense publisher ID is exposed in public source**

`ca-pub-8418485814964449` appears in 10+ HTML files. While AdSense IDs are technically semi-public, exposing them this way lets others create ad-unit spoofs that impersonate your publisher ID. This is low-risk but worth noting. More practically — the same `data-ad-slot` value `7822007431` appears on multiple pages, which means you're using the same ad unit everywhere instead of unique units per page, which reduces AdSense revenue and reporting accuracy.

**18. `X-Forwarded-For` override can be bypassed by a reverse proxy chain**

In the Apache config, the header is set to `REMOTE_ADDR`. However, the slowapi rate limiter's `get_remote_address` reads `X-Forwarded-For` from the incoming request headers by default. If there's any other proxy in front of Apache, users can spoof this header to bypass rate limiting. Configure slowapi to use a trusted proxy list or switch to `REMOTE_ADDR` directly:
```python
from slowapi.util import get_remote_address
# Or use a custom key_func that reads from a trusted header only
```

**19. `alert()` used for unimplemented features in `main.js` (line ~75)**

```js
alert('Join Quiz functionality not implemented yet');
```
Native `alert()` blocks the main thread, is un-styleable, and looks unprofessional. Replace with your existing in-page notification system (`showNotification()` or similar) or simply disable the button with a tooltip.

**20. `browser-polyfills.js` uses `eval()` for JSON parsing (line 319)**

```js
return eval('(' + str + ')');
```
This is a security risk and completely unnecessary — `JSON.parse()` has been universally available since 2011. Replace with:
```js
return JSON.parse(str);
```

**21. Password minimum length in Sentle is only 6 characters with no complexity requirement**

`sentle.js` validates `password.length < 6`. Six characters is below modern minimum recommendations (NIST recommends 8+, ideally 12+). The registration UX also sends passwords over POST to `/api/v1/sentle/register` in plaintext JSON body, which is fine over HTTPS but should be noted. Raise the minimum and add a hint about password strength.

**22. `robots.txt` and `sitemap.xml` are concatenated into a single file**

Confirmed — the file literally ends with `Sitemap: https://quizthespire.com/sitemap.xml<?xml version="1.0"...` on the same line. The sitemap XML runs on without a newline. This makes `robots.txt` invalid and could confuse crawlers. They must be two separate files with the sitemap only referenced by URL in robots.txt, not appended inline.

Let me do a full sweep of all remaining files not yet examined.## Additional Issues Found (23–31)

**Issue 23 — Hardcoded `localhost:8001` URLs in production JavaScript**

`index.html` contains `http://localhost:8001/api/v1/download/conversion` on lines 536, 566, and 651. On the live server these requests will go to `localhost` on the *user's machine*, not the server — meaning the Windows download redirect is completely broken for anyone not running the backend locally. Same issue in `pages/conversion/index.html` line 309. Replace every occurrence with a relative path:
```js
// Before:
window.location.href = 'http://localhost:8001/api/v1/download/conversion';
// After:
window.location.href = '/api/v1/download/conversion';
```

**Issue 24 — User passwords stored in `localStorage` in plaintext**

`quizlogin.js` stores the raw user password in `localStorage.setItem('user_password', userData.password)` and reads it back on each session restore. `donationProgress.js` stores an admin password in `localStorage.setItem('donationAdminPassword', password)`. `localStorage` is readable by any JavaScript on the page, including injected ads and third-party scripts, making this a serious credential exposure risk. The correct pattern is to store only a short-lived JWT/session token and never the password itself.

**Issue 25 — RFID code (credential) stored in `sessionStorage`**

`login.js` stores the raw RFID badge code in `sessionStorage`. The RFID code is functionally a password — it's used to authenticate. It should not be persisted client-side at all after the initial authentication request succeeds. Store only the resulting JWT or session token.

**Issue 26 — Client-side IP ban check in `ip.js` is trivially bypassable**

`ip.js` fetches the client's IP from a third-party service (`api.ipify.org`), stores it in `sessionStorage`, then sends it to `/api/v1/ip-status` to check if banned. Any user can intercept this request with browser devtools and substitute any IP they want. IP ban enforcement must happen entirely on the server side — Apache already knows the real `REMOTE_ADDR` and passes it via `X-Forwarded-For`. The client-side IP check provides zero real security and should be removed. The ban logic should run server-side on every request via middleware.

**Issue 27 — WebRTC used to expose local IP address**

`ip.js` has a `getIpFromWebRTC()` fallback that creates an `RTCPeerConnection` specifically to leak the user's local network IP from ICE candidates. This technique is a well-known privacy violation — it bypasses VPNs and exposes LAN addresses. It serves no legitimate purpose for a ban-check system and should be removed entirely.

**Issue 28 — `download_tracker.json` stored inside the web-served frontend directory path**

Looking at `app.py` line 438, `DOWNLOAD_TRACKER_FILE` is stored inside the backend directory, which is fine. However `CONVERSION_FILE_PATH` (line 439) points to `../frontend/downloads/ConvertTheSpireReborn.zip` — the downloads folder is **inside the Apache document root** (`frontend/`). This means anyone can directly download `https://quizthespire.com/downloads/ConvertTheSpireReborn.zip` without going through the backend's tracking or rate-limiting logic. If you want download counting/tracking to work, the files need to live outside the web root and be served only through the backend endpoint.

**Issue 29 — `manage_token` JWT stored in `localStorage` instead of `httpOnly` cookie**

`manage.js`, `employee.js`, and `schedule.js` all store the auth JWT in `localStorage.setItem('manage_token', token)`. JWTs in `localStorage` are accessible to any JavaScript on the page, making them vulnerable to XSS. If a script injection occurs (e.g. via the ad network or a CDN compromise), the attacker can steal the admin token. Store session tokens in `httpOnly; Secure; SameSite=Strict` cookies instead so JavaScript can't read them.

**Issue 30 — `donationProgress.js` exposes the `UserServer` admin account credentials pathway**

The donation progress widget logs in as a special admin account (`UserServer`) using a password stored in `localStorage`. This means the `UserServer` credentials pathway is exposed through client-side JavaScript. Any user who inspects the source can understand the account structure and attempt to compromise it. This feature should use a read-only public API endpoint, not admin credentials.

**Issue 31 — No `<meta name="robots">` on admin pages**

The admin pages (`/pages/admin/`, `/pages/sentle-admin/`) don't have `<meta name="robots" content="noindex, nofollow">` in their `<head>`. Even though they're gated by login, they may be indexed by Google if the crawler gets through — exposing the admin interface URL structure. Add to each:
```html
<meta name="robots" content="noindex, nofollow">
```

Let me audit the remaining unexamined files thoroughly.---

## New Issues Found (32–42)

**Issue 32 — `slowapi` rate limiter is imported and configured but never applied**

The `slowapi` package is installed and `limiter = Limiter(key_func=get_remote_address)` is set up at line 275, but **zero endpoints use `@limiter.limit()`**. Every single API endpoint — including `/api/v1/login`, `/api/v1/register`, `/api/sentle/login`, `/api/sentle/register`, and `/api/sentle/guess` — is completely unprotected against brute-force and abuse. Apply rate limits like this:

```python
@app.post("/api/v1/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...

@app.post("/api/v1/register")
@limiter.limit("5/minute")
async def register(request: Request, ...):
    ...
```

**Issue 33 — Sentle admin token is not stored server-side — any non-empty string passes**

`admin_login` generates `secrets.token_urlsafe(32)` and returns it, but **never stores it**. `verify_admin_token` then accepts any non-empty `Bearer` value — including `Bearer x`. The comment even admits this: *"For now, we'll accept the token if it's non-empty"*. Fix by storing issued tokens in a short-lived in-memory set:

```python
_admin_tokens: set[str] = set()

@app.post("/api/sentle/admin/login")
async def admin_login(payload: ...):
    ...
    token = secrets.token_urlsafe(32)
    _admin_tokens.add(token)
    return {"admin_token": token}

def verify_admin_token(request: Request):
    token = request.headers.get("Authorization", "")[7:]
    if token not in _admin_tokens:
        raise HTTPException(status_code=401, detail="Invalid token")
```

**Issue 34 — 50 endpoints leak raw exception strings to API clients**

Patterns like `detail=f"Error loading stats: {str(e)}"` appear 50 times. Database errors, file paths, and stack traces can appear in these messages — leaking internal implementation details that help attackers. Replace with generic messages and log the real error server-side:

```python
# Before:
raise HTTPException(status_code=500, detail=f"Error loading stats: {str(e)}")

# After:
logger.error("Error loading stats", exc_info=True)
raise HTTPException(status_code=500, detail="An internal error occurred")
```

**Issue 35 — `sentle_logger` is hardcoded to `DEBUG` level in production**

Lines 90 and 92 set `sentle_logger.setLevel(logging.DEBUG)` unconditionally. In production, DEBUG logs can contain sensitive data (user inputs, SQL queries, token values). Gate this on an environment variable:

```python
log_level = logging.DEBUG if os.getenv("DEBUG_SENTLE", "false").lower() == "true" else logging.INFO
sentle_logger.setLevel(log_level)
```

**Issue 36 — File upload reads entire content into RAM before size validation**

At line 9172, `content = await file.read()` reads the full file into memory *before* checking the 1 GB limit. Since `file.size` may not be set in multipart uploads, a 2 GB upload will OOM the server before the check fires. Stream to disk first using `shutil.copyfileobj` with a chunk limit:

```python
MAX_UPLOAD = 1_000_000_000
written = 0
with open(temp_filepath, "wb") as f:
    async for chunk in request.stream():
        written += len(chunk)
        if written > MAX_UPLOAD:
            f.close()
            os.remove(temp_filepath)
            raise HTTPException(413, "File too large")
        f.write(chunk)
```

**Issue 37 — `video_download_rate_limit` dict grows forever — memory leak**

`video_download_rate_limit` is a plain `dict` that gains one entry per unique IP that ever makes a request. Reset entries are only cleared when the same IP makes another request after the window. A server running for weeks will accumulate thousands of stale entries. Use `collections.OrderedDict` with a max size, or clear entries older than `RATE_LIMIT_WINDOW * 2` periodically.

**Issue 38 — `active_video_downloads` and `video_conversion_queue` are unprotected globals**

Both are Python `list`/`dict` structures modified from multiple threads (the background dispatcher thread and the async request handlers). Without a `threading.Lock`, concurrent modifications can cause `RuntimeError: dictionary changed size during iteration`. Wrap all reads and writes with a lock:

```python
_queue_lock = threading.Lock()
with _queue_lock:
    video_conversion_queue.append(...)
```

**Issue 39 — Downloads folder is inside the Apache web root**

Confirmed from `app.py` lines 439–442: `CONVERSION_FILE_PATH` points to `../frontend/downloads/ConvertTheSpireReborn.zip`. Because Apache serves `frontend/` as the document root, `https://quizthespire.com/downloads/ConvertTheSpireReborn.zip` is directly accessible, completely bypassing the download tracking, rate limiting, and analytics logic in the backend. Move the downloads folder outside the web root (e.g., `/var/data/downloads/`) and serve files only through the FastAPI endpoint with `FileResponse`.

**Issue 40 — No pagination on support message endpoints**

`/api/v1/support/rooms/{room_id}/messages` returns messages with no `LIMIT` clause. A support room with thousands of messages will dump the entire history in one response, potentially returning megabytes of data and causing timeouts. Add `?limit=50&offset=0` query parameters and enforce a maximum page size.

**Issue 41 — `print()` used for logging throughout backend instead of the logger**

Searching the backend finds hundreds of `print(f"[DEBUG]...")`, `print(f"Cleaned up...")`, `print(f"Starting conversion request...")` calls scattered throughout. These go to stdout with no log level, no timestamp, and no structured format — making production log monitoring difficult. Replace all `print()` calls with `logger.debug()` / `logger.info()`.

**Issue 42 — `requirements.txt` pins no versions**

```
fastapi
uvicorn
...
```
Every package is unpinned. A fresh `pip install -r requirements.txt` on a new server can pull in incompatible versions and break the site silently. Run `pip freeze > requirements.txt` on the working server to pin exact versions, then test upgrades explicitly.


Let me audit everything not yet covered — remaining HTML pages, CSS, scripts, and config files.Here are the additional issues found:

---

## Issues 43–48 (New)

**Issue 43 — Password sent in every API request as `X-Password` header**

In `spire-ai.js`, every API call sends `headers['X-Password'] = storedPassword` — the raw password is included in every single HTTP request header. HTTP headers appear in server access logs, proxy logs, and browser developer tools. Auth should use a one-time login that returns a JWT or session cookie; subsequent requests should carry only that token, never credentials.

**Issue 44 — Player names injected into `innerHTML` without escaping in quiz**

`quizPlayerListManager.js`'s `generatePlayerHTML()` injects `${playerName}` directly into a template literal that is set via `innerHTML`. A user who registers with a name like `<img src=x onerror=alert(1)>` will execute JavaScript in every other player's browser when the player list updates. Since player names come from user registration and flow through a socket broadcast, this is a **stored XSS** in the quiz session. Fix:
```js
// Add a helper if not already present:
function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// Then:
<div class="player-name">${esc(playerName)}</div>
```

**Issue 45 — `support_user_last_msg` dict grows forever (memory leak)**

`support_user_last_msg = {}` accumulates one entry per user who ever sends a support message and is never pruned. Over time this leaks memory. Add a cleanup: after storing the timestamp, remove entries older than 60 seconds:
```python
support_user_last_msg[user_id] = now
# Prune old entries
cutoff = now - 60
support_user_last_msg = {k: v for k, v in support_user_last_msg.items() if v > cutoff}
```

**Issue 46 — `requirements.txt` has `smbus2` listed twice**

Lines 2 and 5 of `requirements.txt` both declare `smbus2==0.4.1`. This is harmless but indicates the file is manually maintained. Also, Raspberry Pi-specific hardware libraries (`spidev`, `lgpio`, `rpi-lgpio`, `smbus2`, `pygame`) are included in the same requirements file used to deploy the production web server. These will fail to install on a standard Linux server. Split into `requirements-server.txt` (web dependencies only) and `requirements-pi.txt` (hardware dependencies) and deploy only the relevant one.

**Issue 47 — No `Content-Type` validation on file uploads**

The file conversion endpoint at line 9150 checks the filename extension but not the actual MIME type of the upload. A file named `exploit.jpg` containing a malicious script could be uploaded, and if the server processes it based solely on the extension, it may be mishandled. Add MIME type validation using `python-magic`:
```python
import magic
file_mime = magic.from_buffer(await file.read(1024), mime=True)
file.seek(0)  # reset
allowed_mimes = {'image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg', ...}
if file_mime not in allowed_mimes:
    raise HTTPException(400, "Unsupported file type")
```

**Issue 48 — `site.webmanifest` is duplicated in both root and `frontend/`**

There is `/tmp/p1/site.webmanifest` at the repo root and `/tmp/p1/frontend/site.webmanifest` inside the web root. The HTML pages reference `/site.webmanifest` which Apache serves from `frontend/site.webmanifest`. The root-level copy is stale and misleading. Remove the root-level copy and keep only the one in `frontend/`.

---

## Full Outstanding Issues Summary

| # | Severity | Issue |
|---|---|---|
| 1 | 🔴 Critical | Private TLS key committed to public repo |
| 2 | 🔴 Critical | Admin password hardcoded with fallback default |
| 3 | 🟠 High | No Content-Security-Policy header |
| 4 | 🟠 High | `WRITE_EXTERNAL_STORAGE` missing (from Flutter audit) |
| 14 | 🟠 High | CSRF token declared but never generated or validated |
| 15 | 🟠 High | `content.js` renders article data without escaping |
| 23 | 🟠 High | Hardcoded `localhost:8001` URLs in production JS |
| 24 | 🟠 High | Passwords stored in `localStorage` in plaintext |
| 26 | 🟠 High | Client-side IP ban check trivially bypassable |
| 27 | 🟠 High | WebRTC used to leak local IP — privacy violation |
| 28 | 🟠 High | Downloads folder inside Apache web root |
| 29 | 🟠 High | JWT stored in `localStorage` instead of `httpOnly` cookie |
| 32 | 🟠 High | `slowapi` imported but zero endpoints are rate-limited |
| 33 | 🟠 High | Admin token never stored — any non-empty string accepted |
| 34 | 🟠 High | 50 endpoints leak raw exception strings to clients |
| 36 | 🟠 High | File uploaded fully into RAM before size check |
| 43 | 🟠 High | Password sent in every API request header |
| 44 | 🟠 High | Player names injected into `innerHTML` — stored XSS |
| 5 | 🟡 Medium | Missing `Permissions-Policy` header |
| 6 | 🟡 Medium | `robots.txt` and `sitemap.xml` concatenated into one file |
| 7 | 🟡 Medium | Admin/login pages not in `robots.txt` Disallow |
| 8 | 🟡 Medium | 38 `console.log` statements in production JS |
| 19 | 🟡 Medium | `alert()` used for unimplemented features |
| 20 | 🟡 Medium | `eval()` used for JSON parsing |
| 21 | 🟡 Medium | Password minimum only 6 characters |
| 25 | 🟡 Medium | RFID credential stored in `sessionStorage` |
| 30 | 🟡 Medium | `donationProgress` exposes admin account via client-side JS |
| 35 | 🟡 Medium | `sentle_logger` hardcoded to DEBUG level in production |
| 37 | 🟡 Medium | `video_download_rate_limit` dict grows forever |
| 38 | 🟡 Medium | Global queue/dict modified from multiple threads without lock |
| 40 | 🟡 Medium | Support messages endpoint has no pagination |
| 42 | 🟡 Medium | `requirements.txt` has no version pins |
| 45 | 🟡 Medium | `support_user_last_msg` dict grows forever |
| 46 | 🟡 Medium | Pi hardware libs mixed into server requirements |
| 47 | 🟡 Medium | No MIME type validation on file uploads |
| 9 | 🟢 Low | `lastmod` dates stale in sitemap |
| 10 | 🟢 Low | Meta description contains version-specific release notes |
| 11 | 🟢 Low | `X-Forwarded-For` could be spoofed past rate limiter |
| 12 | 🟢 Low | `.DS_Store` committed to repo |
| 13 | 🟢 Low | `.bak` files served from web root |
| 16 | 🟢 Low | Key pages missing from `sitemap.xml` |
| 17 | 🟢 Low | Same AdSense slot ID on every page |
| 18 | 🟢 Low | Version number in `<meta description>` |
| 31 | 🟢 Low | Admin pages lack `<meta name="robots" content="noindex">` |
| 39 | 🟢 Low | `print()` used instead of logger throughout backend |
| 41 | 🟢 Low | `print()` used instead of logger throughout backend |
| 48 | 🟢 Low | Duplicate `site.webmanifest` at repo root |



