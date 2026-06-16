# Markup Clone

Comment directly on live URLs — a [markup.io](https://www.markup.io/)-style review tool.
Paste a link, drop pinned comments anywhere on the page, resolve them, and share the
review link with anyone.

## How it works

It's a **server-side proxy** (the same approach markup.io uses):

1. You create a *review* from a URL.
2. The Next.js server fetches that page and rewrites every link/asset (`href`, `src`,
   `srcset`, CSS `url(...)`, etc.) to route back through the proxy — so the page renders
   same-origin and isn't blocked by `X-Frame-Options` / CSP.
3. It injects a small overlay script (`public/overlay.js`) into the page. That script
   handles comment mode, click-to-drop pins, the comments panel, and resolve/delete.
4. Comments are stored server-side and re-anchored to the element you clicked (via a CSS
   selector + relative offset), so pins survive reloads and minor layout shifts.

## Run

```bash
cd markup-clone
npm install
npm run dev
# open http://localhost:3000
```

Enter a URL → you land on `/review/<id>` → click the **💬 Comment** button (bottom-right of
the page) to turn on comment mode → click anywhere to leave a comment. Use **Copy share
link** to send the review to someone else.

## Architecture

| Path | Role |
|------|------|
| `src/app/page.tsx` | Home — create a review from a URL |
| `src/app/review/[id]/page.tsx` | Toolbar + iframe of the proxied page |
| `src/app/api/proxy/[id]/route.ts` | Fetches + rewrites + injects overlay |
| `src/app/api/reviews/...` | Create review, list/add comments |
| `src/app/api/comments/[id]/route.ts` | Resolve / delete a comment |
| `src/lib/proxy.ts` | HTML/CSS URL rewriting + overlay injection |
| `src/lib/db.ts` | JSON file store (`data/db.json`) |
| `public/overlay.js` | The injected commenting layer (pins, panel, composer) |

## Known limitations (it's an MVP)

- **Heavy JS apps / SPAs**: assets loaded dynamically at runtime aren't rewritten, so
  client-rendered apps may render partially. Works best on mostly-static pages.
- **Auth-gated / anti-bot pages**: the proxy fetches anonymously — login-walled or
  bot-protected (Cloudflare, etc.) pages won't load.
- **Forms / POST**: only `GET` is proxied; form submissions inside the page may break.
- **Storage**: a single JSON file — fine for local use, swap for a real DB
  (Postgres/SQLite) for multi-user production.
- **No auth**: anyone with the review link can read/add/resolve comments.

## Natural next steps

Threaded replies, screenshots per comment, projects/folders, real auth + accounts, a
proper database, and a browser-extension mode (for pages the proxy can't reach).
