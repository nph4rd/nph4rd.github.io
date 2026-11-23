# Newsletter Architecture & Operations (`nphard.io`)

Self-hosted email newsletter for blog posts and digests on GitHub Pages, built with **Jekyll + Cloudflare Workers + Resend + GitHub Actions**. Zero runtime npm dependencies, zero database.

---

## How It Works

### 1. Subscribe Flow (Stateless Double Opt-In)

```text
Browser (nphard.io/about/ or bottom of any post)
  │  POST /subscribe { email, website }
  ▼
Cloudflare Worker (nphard-newsletter.arturomf94.workers.dev)
  │  - Enforces ALLOWED_ORIGINS CORS + honeypot field ("website")
  │  - Signs { email, exp: +24h } with HMAC-SHA256 (SIGNING_SECRET)
  │  - Calls Resend POST /emails with confirmation link
  ▼
Subscriber's Inbox
  │  Clicks GET /confirm?token=...
  ▼
Cloudflare Worker
  │  - Verifies HMAC signature & expiry
  │  - Calls Resend POST /contacts (and PATCH/segment fallback if re-subscribing)
  │  - 302 redirects to https://nphard.io/subscribe/?status=confirmed
  ▼
nphard.io/subscribe/ (unlisted confirmation landing page)
```

### 2. Publish & Broadcast Flow

```text
git push to master (adding a new file in _posts/)
  ▼
GitHub Actions (.github/workflows/newsletter.yml)
  │  - Finds newly added files only: git diff --diff-filter=A -- _posts/
  │  - Runs: node newsletter/send.mjs <new-post-files>
  ▼
newsletter/send.mjs
  │  - Skips if front matter has `newsletter: false`
  │  - Skips future-dated posts unless `publish_now: true`
  │  - Renders email:
  │      • Digests (categories includes "digest"): full post + absolutized image/link URLs
  │      • Blog posts: leading ASCII art + opening excerpt + "Read the full post →" button
  │        (MathJax does not run in email clients)
  │  - Polls HEAD <post-url> until GitHub Pages returns 200 (up to 3 min)
  │  - Calls Resend POST /broadcasts with send: true and {{{RESEND_UNSUBSCRIBE_URL}}}
  ▼
Subscribers' Inboxes (one-click unsubscribe handled natively by Resend)
```

---

## File Map

| Path | Purpose |
| :--- | :--- |
| `_includes/newsletter-form.html` | Discreet inline subscribe form + vanilla JS submit handler + RSS link |
| `_layouts/post.html` | Includes `newsletter-form.html` at the bottom of every blog post and digest |
| `about.md` | Includes `newsletter-form.html` at the bottom of `/about/` |
| `subscribe.html` | Unlisted `/subscribe/` confirmation page reading `?status=confirmed\|check-inbox\|invalid\|error` |
| `style.scss` | Styles for `.newsletter-box`, `.newsletter-form`, `.newsletter-status`, `.newsletter-banner` |
| `_config.yml` | Sets `url: https://nphard.io`, `newsletter.endpoint`, and excludes `newsletter/` from `_site/` |
| `newsletter/worker/src/index.js` | Cloudflare Worker (`/subscribe`, `/confirm`, `/health`) |
| `newsletter/worker/wrangler.toml` | Worker name, non-secret env vars (`SITE_URL`, `FROM_EMAIL`, `ALLOWED_ORIGINS`) |
| `newsletter/send.mjs` | Front matter parser, Markdown-to-email renderer, GitHub Pages readiness check, Resend Broadcast client |
| `.github/workflows/newsletter.yml` | Auto-sends on new `_posts/**` commits to `master` + manual `workflow_dispatch` |
| `newsletter/test/send.test.mjs` | Unit tests for `send.mjs` (also parses every existing post in `_posts/`) |
| `newsletter/worker/test/worker.test.mjs` | Unit tests for Worker HMAC signing, CORS, honeypot, and Resend calls |

---

## Live Infrastructure & External Services

### Cloudflare Worker
- **Name:** `nphard-newsletter`
- **URL:** `https://nphard-newsletter.arturomf94.workers.dev` (referenced in `_config.yml` → `newsletter.endpoint`)
- **Non-secret vars** (`newsletter/worker/wrangler.toml`):
  - `SITE_URL = "https://nphard.io"`
  - `FROM_EMAIL = "np <newsletter@nphard.io>"`
  - `ALLOWED_ORIGINS = "https://nphard.io,https://www.nphard.io"`
- **Secrets** (stored in Cloudflare, not in git):
  - `RESEND_API_KEY` — Resend **Full access** key (Sending-only keys fail on `POST /contacts`)
  - `RESEND_SEGMENT_ID` — target Resend Segment UUID
  - `SIGNING_SECRET` — random 32-byte hex key for double opt-in HMAC tokens

### Resend
- **Domain:** `nphard.io` (`us-east-1`, verified via DNS)
- **From address:** `np <newsletter@nphard.io>`
- **Segment:** `General` (ID stored in Cloudflare + GitHub Actions secrets as `RESEND_SEGMENT_ID`)
- **API Key permission:** Must be **Full access** (required for Contacts, Segments, and Broadcasts).

### DNS (Squarespace Domains)
Four custom records on `nphard.io` for Resend verification:
- `TXT` `resend._domainkey` (DKIM public key)
- `MX` `send` → `10 feedback-smtp.us-east-1.amazonses.com`
- `TXT` `send` → `v=spf1 include:amazonses.com ~all`
- `CNAME` `rsend` → `send.forge.rmta.net`

### GitHub Actions (`nph4rd/nph4rd.github.io`)
- **Repository Secrets:** `RESEND_API_KEY`, `RESEND_SEGMENT_ID`
- **Optional Repository Variables:** `NEWSLETTER_FROM` (defaults to `np <newsletter@nphard.io>`), `NEWSLETTER_REPLY_TO`

---

## Front Matter Controls

- **Normal publish:** Add `_posts/YYYY-MM-DD-slug.md` and push to `master`. Editing an existing post later does **not** re-send (`--diff-filter=A` only matches added files).
- **Skip newsletter for a post:** Add `newsletter: false` to its front matter.
- **Future-dated posts:** Because `_config.yml` sets `future: true`, `newsletter/send.mjs` skips posts whose date is in the future *unless* `publish_now: true` is present in front matter.
- **Custom blog post summary:** Adding `description: "..."` in front matter overrides the auto-extracted opening paragraph excerpt in blog post emails.

---

## Common Maintenance Tasks

### Run unit tests
```bash
node --test newsletter/test/send.test.mjs newsletter/worker/test/worker.test.mjs
```

### Preview an email locally (no API call)
```bash
node newsletter/send.mjs _posts/2026-11-03-aug-oct-26-digest.md --dry-run
```

### Manually trigger a broadcast via GitHub Actions
```bash
# Dry run (logs only)
gh workflow run newsletter.yml -f post_path="_posts/2026-11-03-aug-oct-26-digest.md" -f dry_run=true -f draft=false

# Create a draft in Resend dashboard without sending
gh workflow run newsletter.yml -f post_path="_posts/2026-11-03-aug-oct-26-digest.md" -f dry_run=false -f draft=true

# Send live to all subscribers in the segment
gh workflow run newsletter.yml -f post_path="_posts/2026-11-03-aug-oct-26-digest.md" -f dry_run=false -f draft=false
```

### Modify & redeploy the Cloudflare Worker
```bash
cd newsletter/worker
npx wrangler deploy
```

### Rotate secrets
```bash
# Cloudflare Worker
cd newsletter/worker
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_SEGMENT_ID
openssl rand -hex 32 | tr -d '\n' | npx wrangler secret put SIGNING_SECRET

# GitHub Actions
gh secret set RESEND_API_KEY
gh secret set RESEND_SEGMENT_ID
```

### Edit email copy or styling
- **Double opt-in confirmation email:** `buildConfirmationEmail()` in `newsletter/worker/src/index.js` (requires `npx wrangler deploy` afterward).
- **Post / digest broadcast email:** `buildBroadcastEmail()` in `newsletter/send.mjs` (takes effect on next push to `master`).
- **On-site subscribe form:** `_includes/newsletter-form.html` and the `.newsletter-*` rules in `style.scss`.
