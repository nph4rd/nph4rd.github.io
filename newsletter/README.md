# Newsletter Setup (Cloudflare Worker + Resend + GitHub Actions)

This directory contains the self-hosted newsletter pipeline for `nphard.io`:

- **`newsletter/worker/`** — Stateless Cloudflare Worker that accepts signups (`POST /subscribe`), sends a 24h HMAC-signed double opt-in email via Resend, and confirms subscribers (`GET /confirm?token=...`) into a Resend Segment.
- **`newsletter/send.mjs`** — Zero-dependency Node script run by `.github/workflows/newsletter.yml` whenever a new post or digest is pushed to `_posts/` on `master`. Digests are sent in full; long blog posts are sent with their opening excerpt + a link to `nphard.io` (so MathJax and interactive elements render properly in the browser).

## 1. Set up Resend

1. Create a free account at [resend.com](https://resend.com).
2. Add and verify your custom domain **`nphard.io`** (Resend gives you DKIM/SPF DNS records to add at your DNS provider).
3. In Resend → **Audiences / Segments**, create a Segment (e.g. `Newsletter`) and copy its **Segment ID**.
4. In Resend → **API Keys**, create an API key with full access (needed for Contacts, Broadcasts, and sending confirmation emails).

## 2. Deploy the Cloudflare Worker

```bash
cd newsletter/worker
npx wrangler login

# Set the 3 required secrets:
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_SEGMENT_ID
# Generate a random secret first (e.g. `openssl rand -hex 32`):
npx wrangler secret put SIGNING_SECRET

# Deploy:
npx wrangler deploy
```

Wrangler will output your Worker URL (e.g. `https://nphard-newsletter.<your-subdomain>.workers.dev`).

*(Optional)* If `nphard.io` DNS is on Cloudflare, you can uncomment the `routes` block in `newsletter/worker/wrangler.toml` to host the Worker cleanly at `https://newsletter.nphard.io`.

## 3. Point Jekyll at your Worker URL

Edit `_config.yml` and set `newsletter.endpoint` to your deployed Worker URL (without a trailing slash):

```yaml
newsletter:
  endpoint: "https://nphard-newsletter.<your-subdomain>.workers.dev"
```

## 4. Add GitHub Repository Secrets

In GitHub → **Settings → Secrets and variables → Actions**:

- **Secrets:**
  - `RESEND_API_KEY` — same Resend API key
  - `RESEND_SEGMENT_ID` — your Resend Segment ID
- **Variables (optional):**
  - `NEWSLETTER_FROM` — defaults to `np <newsletter@nphard.io>`
  - `NEWSLETTER_REPLY_TO` — optional reply-to address

## 5. How Publishing Works

- **Automatic on push:** Adding a new file in `_posts/` and pushing to `master` triggers `.github/workflows/newsletter.yml`, waits until GitHub Pages serves the live URL, and sends a Resend Broadcast to your segment (including Resend's automatic `{{{RESEND_UNSUBSCRIBE_URL}}}` footer).
- **Editing an existing post** does **not** re-send an email (`git diff --diff-filter=A` only picks up newly added files).
- **Draft / opt-out safety:**
  - Future-dated posts are skipped automatically unless `publish_now: true` is in front matter.
  - Add `newsletter: false` to any post's front matter to skip emailing it.
- **Manual send / dry run:**
  - Locally: `node newsletter/send.mjs _posts/2026-11-03-aug-oct-26-digest.md --dry-run`
  - In GitHub UI: **Actions → Send Newsletter Broadcast → Run workflow** (supports `dry_run` and `draft` modes).

## Running Tests

```bash
node --test newsletter/test/send.test.mjs newsletter/worker/test/worker.test.mjs
```
