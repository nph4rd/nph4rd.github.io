#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE_URL = "https://nphard.io";
const DEFAULT_FROM = "np <newsletter@nphard.io>";

export function parseFrontMatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: normalized };
  }

  const rawYaml = match[1];
  const body = match[2];
  const data = {};
  const lines = rawYaml.split("\n");
  let currentListKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (currentListKey && /^\s*-\s+/.test(line)) {
      const item = stripQuotes(line.replace(/^\s*-\s+/, "").trim());
      data[currentListKey].push(item);
      continue;
    }

    currentListKey = null;
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const rawVal = kv[2].trim();

    if (rawVal === "") {
      data[key] = [];
      currentListKey = key;
    } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      const inner = rawVal.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(",").map((item) => stripQuotes(item.trim())).filter(Boolean)
        : [];
    } else if (rawVal === "true") {
      data[key] = true;
    } else if (rawVal === "false") {
      data[key] = false;
    } else {
      data[key] = stripQuotes(rawVal);
    }
  }

  return { data, body };
}

function stripQuotes(str) {
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    return str.slice(1, -1);
  }
  return str;
}

export function readSiteUrl(repoRoot) {
  try {
    const config = fs.readFileSync(path.join(repoRoot, "_config.yml"), "utf8");
    const match = config.match(/^\s*url\s*:\s*(.+)$/m);
    if (match) {
      return stripQuotes(match[1].split("#")[0].trim()).replace(/\/+$/, "");
    }
  } catch {
    // Fall back to default
  }
  return DEFAULT_SITE_URL;
}

export function parsePostMeta(filePath, markdown, siteUrl = DEFAULT_SITE_URL) {
  const { data, body } = parseFrontMatter(markdown);
  const baseName = path.basename(filePath);
  const fileMatch = baseName.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.(md|markdown|html)$/i);
  if (!fileMatch) {
    throw new Error(`Post filename does not match YYYY-MM-DD-slug.md: ${filePath}`);
  }

  let [, year, month, day, slug] = fileMatch;
  let postDate = new Date(`${year}-${month}-${day}T00:00:00Z`);

  if (typeof data.date === "string" && data.date.trim()) {
    const fmDateMatch = data.date.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (fmDateMatch) {
      [, year, month, day] = fmDateMatch;
    }
    const parsed = new Date(data.date.trim());
    if (!Number.isNaN(parsed.getTime())) {
      postDate = parsed;
    }
  }

  const categories = Array.isArray(data.categories)
    ? data.categories
    : typeof data.categories === "string"
      ? data.categories.split(/\s+/).filter(Boolean)
      : [];

  const isDigest = categories.some((c) => c.toLowerCase() === "digest");
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug;

  const cleanSiteUrl = siteUrl.replace(/\/+$/, "");
  let url;
  if (typeof data.permalink === "string" && data.permalink.trim()) {
    const perm = data.permalink.trim();
    url = perm.startsWith("http")
      ? perm
      : `${cleanSiteUrl}/${perm.replace(/^\/+/, "")}`;
  } else {
    url = `${cleanSiteUrl}/${year}/${month}/${day}/${slug}.html`;
  }

  return {
    filePath,
    slug,
    title,
    date: postDate,
    dateIso: `${year}-${month}-${day}`,
    categories,
    isDigest,
    publishNow: data.publish_now === true,
    newsletterOptOut: data.newsletter === false,
    description: typeof data.description === "string" ? data.description.trim() : "",
    url,
    body,
  };
}

export function shouldSendPost(meta, { force = false, now = new Date() } = {}) {
  if (meta.newsletterOptOut) {
    return { ok: false, reason: "front matter sets newsletter: false" };
  }
  if (!force && !meta.publishNow && meta.date.getTime() > now.getTime()) {
    return {
      ok: false,
      reason: `post date (${meta.dateIso}) is in the future and publish_now is not true`,
    };
  }
  return { ok: true, reason: "eligible" };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absolutizeHtmlUrls(html, siteUrl) {
  const base = siteUrl.replace(/\/+$/, "");
  return html.replace(/\b(src|href)=(["'])(\/(?!\/)[^"']*)\2/gi, (_, attr, quote, relPath) => {
    return `${attr}=${quote}${base}${relPath}${quote}`;
  });
}

function renderInlineMarkdown(text, siteUrl) {
  const base = siteUrl.replace(/\/+$/, "");
  // Remove markdown footnote references like [^1]
  let out = text.replace(/\[\^[^\]]+\]/g, "");

  // Protect inline code spans first
  const codeSpans = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSpans.push(
      `<code style="background-color:#ccd0da;color:#4c4f69;padding:1px 4px;border-radius:3px;font-size:90%;">${escapeHtml(code)}</code>`
    ) - 1;
    return `\u0000CODE${idx}\u0000`;
  });

  // Escape raw HTML in markdown text
  out = escapeHtml(out);

  // Links: [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
    const resolved = href.startsWith("/") && !href.startsWith("//") ? `${base}${href}` : href;
    return `<a href="${resolved}" style="color:#1e66f5;text-decoration:underline;">${label}</a>`;
  });

  // Bold & italic
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");

  // Restore inline code spans
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)]);
  return out;
}

function stripMarkdownToText(md, siteUrl) {
  const base = siteUrl.replace(/\/+$/, "");
  return md
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const resolved = href.startsWith("/") && !href.startsWith("//") ? `${base}${href}` : href;
      return `${label} (${resolved})`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderDigestBodyHtml(body, siteUrl) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block (often ASCII art header)
    if (trimmed.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        `<pre style="margin:0 0 18px;padding:12px 14px;background-color:#e6e9ef;color:#4c4f69;border-radius:4px;overflow-x:auto;font-family:'Berkeley Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.25;">${escapeHtml(codeLines.join("\n"))}</pre>`
      );
      continue;
    }

    // Raw HTML block (e.g., <figure>...</figure>, <div>...</div>)
    if (/^<(figure|div|p|blockquote|table|img)\b/i.test(trimmed)) {
      const htmlLines = [line];
      const tagMatch = trimmed.match(/^<([a-z0-9]+)/i);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : "";
      const selfClosing = tagName === "img" || trimmed.includes(`</${tagName}>`) || trimmed.endsWith("/>");
      i++;
      if (!selfClosing && tagName) {
        while (i < lines.length) {
          htmlLines.push(lines[i]);
          if (lines[i].toLowerCase().includes(`</${tagName}>`)) {
            i++;
            break;
          }
          i++;
        }
      }
      blocks.push(absolutizeHtmlUrls(htmlLines.join("\n"), siteUrl));
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length + 1, 4);
      blocks.push(
        `<h${level} style="margin:20px 0 10px;color:#4c4f69;font-size:${level === 2 ? 18 : 15}px;">${renderInlineMarkdown(headingMatch[2], siteUrl)}</h${level}>`
      );
      i++;
      continue;
    }

    // Unordered / ordered list (with optional indented sub-items)
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      const items = [];
      while (i < lines.length) {
        const cur = lines[i];
        const curTrim = cur.trim();
        if (!curTrim) break;
        if (/^[-*+]\s+/.test(curTrim) && !/^\s{2,}/.test(cur)) {
          items.push({ text: curTrim.replace(/^[-*+]\s+/, ""), sub: [] });
          i++;
        } else if (/^\d+\.\s+/.test(curTrim) && !/^\s{2,}/.test(cur)) {
          items.push({ text: curTrim.replace(/^\d+\.\s+/, ""), sub: [] });
          i++;
        } else if (/^\s{2,}([-*+]|\d+\.)\s+/.test(cur) && items.length > 0) {
          items[items.length - 1].sub.push(curTrim.replace(/^([-*+]|\d+\.)\s+/, ""));
          i++;
        } else if (/^\s{2,}/.test(cur) && items.length > 0) {
          items[items.length - 1].text += " " + curTrim;
          i++;
        } else {
          break;
        }
      }
      const tag = isOrdered ? "ol" : "ul";
      const renderedItems = items
        .map((item) => {
          const subHtml = item.sub.length
            ? `<ol style="margin:6px 0 4px;padding-left:20px;">${item.sub
                .map((s) => `<li style="margin:4px 0;">${renderInlineMarkdown(s, siteUrl)}</li>`)
                .join("")}</ol>`
            : "";
          return `<li style="margin:0 0 10px;">${renderInlineMarkdown(item.text, siteUrl)}${subHtml}</li>`;
        })
        .join("");
      blocks.push(`<${tag} style="margin:0 0 16px;padding-left:22px;">${renderedItems}</${tag}>`);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push(`<hr style="border:none;border-top:1px solid #ccd0da;margin:18px 0;" />`);
      i++;
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !/^<(figure|div|p|blockquote|table|img)\b/i.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^#{1,4}\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(`<p style="margin:0 0 14px;">${renderInlineMarkdown(paraLines.join(" "), siteUrl)}</p>`);
  }

  return blocks.join("\n");
}

function extractBlogExcerpt(meta, siteUrl) {
  const lines = meta.body.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let asciiArt = null;

  while (i < lines.length && !lines[i].trim()) i++;

  // Capture leading ASCII art block if present
  if (i < lines.length && lines[i].trim().startsWith("```")) {
    const codeLines = [];
    i++;
    while (i < lines.length && !lines[i].trim().startsWith("```")) {
      codeLines.push(lines[i]);
      i++;
    }
    i++;
    const rawArt = codeLines.join("\n").trimEnd();
    if (rawArt) asciiArt = rawArt;
  }

  if (meta.description) {
    return {
      asciiArt,
      paragraphs: [meta.description],
    };
  }

  // Extract first 1–2 prose paragraphs before any section heading / HR
  const paragraphs = [];
  let charBudget = 0;
  while (i < lines.length && paragraphs.length < 2 && charBudget < 650) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (
      trimmed.startsWith("#") ||
      trimmed.startsWith("```") ||
      /^[-*_]{3,}$/.test(trimmed) ||
      /^</.test(trimmed) ||
      /^[-*+]\s+/.test(trimmed) ||
      /^\d+\.\s+/.test(trimmed)
    ) {
      if (paragraphs.length > 0) break;
      // Skip non-prose element before first paragraph
      if (trimmed.startsWith("```")) {
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) i++;
      }
      i++;
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !/^[-*_]{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    const text = paraLines.join(" ").replace(/^\*\*Description\*\*:\s*/i, "");
    if (text) {
      paragraphs.push(text);
      charBudget += text.length;
    }
  }

  return { asciiArt, paragraphs, siteUrl };
}

export function buildBroadcastEmail(meta, siteUrl = DEFAULT_SITE_URL) {
  const cleanSiteUrl = siteUrl.replace(/\/+$/, "");
  const siteHost = cleanSiteUrl.replace(/^https?:\/\//, "");
  const subject = meta.isDigest ? `[np digest] ${meta.title}` : `[np] ${meta.title}`;
  const kindLabel = meta.isDigest ? "DIGEST" : "NEW POST";

  let innerHtml;
  let innerText;

  if (meta.isDigest) {
    innerHtml = renderDigestBodyHtml(meta.body, cleanSiteUrl);
    innerText = stripMarkdownToText(meta.body, cleanSiteUrl);
  } else {
    const { asciiArt, paragraphs } = extractBlogExcerpt(meta, cleanSiteUrl);
    const partsHtml = [];
    const partsText = [];

    if (asciiArt) {
      partsHtml.push(
        `<pre style="margin:0 0 18px;padding:12px 14px;background-color:#e6e9ef;color:#4c4f69;border-radius:4px;overflow-x:auto;font-family:'Berkeley Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.25;">${escapeHtml(asciiArt)}</pre>`
      );
      partsText.push(asciiArt);
    }

    for (const p of paragraphs) {
      partsHtml.push(`<p style="margin:0 0 14px;">${renderInlineMarkdown(p, cleanSiteUrl)}</p>`);
      partsText.push(stripMarkdownToText(p, cleanSiteUrl));
    }

    if (partsHtml.length === 0) {
      partsHtml.push(
        `<p style="margin:0 0 14px;">A new post is up on ${escapeHtml(siteHost)}.</p>`
      );
      partsText.push(`A new post is up on ${siteHost}.`);
    }

    innerHtml = partsHtml.join("\n");
    innerText = partsText.join("\n\n");
  }

  const ctaLabel = meta.isDigest ? `Read on ${siteHost} &rarr;` : `Read the full post &rarr;`;
  const ctaText = meta.isDigest ? `Read on ${siteHost}: ${meta.url}` : `Read the full post: ${meta.url}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#eff1f5;color:#4c4f69;font-family:'Berkeley Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;line-height:1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eff1f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background-color:#ffffff;border:1px solid #ccd0da;border-radius:6px;padding:28px;">
            <tr>
              <td>
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:1.2px;color:#8c8fa1;text-transform:uppercase;">${kindLabel} &middot; ${escapeHtml(meta.dateIso)}</p>
                <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:#4c4f69;">
                  <a href="${escapeHtml(meta.url)}" style="color:#4c4f69;text-decoration:none;">${escapeHtml(meta.title)}</a>
                </h1>
                <div style="color:#4c4f69;">
                  ${innerHtml}
                </div>
                <p style="margin:24px 0 0;">
                  <a href="${escapeHtml(meta.url)}" style="display:inline-block;padding:10px 18px;background-color:#1e66f5;color:#eff1f5;text-decoration:none;border-radius:4px;font-weight:bold;">${ctaLabel}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e6e9ef;margin:28px 0 16px;" />
                <p style="margin:0;font-size:12px;color:#8c8fa1;">
                  You're receiving this because you subscribed at <a href="${escapeHtml(cleanSiteUrl)}" style="color:#6c6f85;text-decoration:underline;">${escapeHtml(siteHost)}</a>.
                  &middot; <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#6c6f85;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${meta.title} (${meta.dateIso})`,
    "=".repeat(Math.min(meta.title.length, 60)),
    "",
    innerText,
    "",
    ctaText,
    "",
    "---",
    `Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}`,
  ].join("\n");

  return { subject, html, text };
}

async function waitForUrl(url, { timeoutMs = 180_000, intervalMs = 10_000, fetchImpl = fetch } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetchImpl(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`Live URL verified (${res.status}): ${url}`);
        return true;
      }
      console.log(`Waiting for GitHub Pages deploy (${res.status}): ${url}`);
    } catch (err) {
      console.log(`Waiting for GitHub Pages deploy (${err.message}): ${url}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.warn(`Proceeding after wait timeout; URL was not yet 200: ${url}`);
  return false;
}

export async function sendResendBroadcast(
  { apiKey, segmentId, from, replyTo, name, subject, html, text, send = true },
  fetchImpl = fetch
) {
  const payload = {
    name,
    segment_id: segmentId,
    from,
    subject,
    html,
    text,
    send,
  };
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const res = await fetchImpl("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Resend /broadcasts failed (${res.status}): ${responseText}`);
  }
  return JSON.parse(responseText);
}

function parseCliArgs(argv) {
  const args = {
    files: [],
    dryRun: false,
    draft: false,
    force: false,
    skipWait: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--draft") args.draft = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--skip-wait") args.skipWait = true;
    else if (!arg.startsWith("--")) args.files.push(arg);
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.files.length === 0) {
    console.log("No post files provided. Usage: node newsletter/send.mjs _posts/<file>.md [--dry-run] [--draft] [--force] [--skip-wait]");
    process.exit(0);
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const siteUrl = (process.env.SITE_URL || readSiteUrl(repoRoot)).replace(/\/+$/, "");
  const apiKey = process.env.RESEND_API_KEY || "";
  const segmentId = process.env.RESEND_SEGMENT_ID || "";
  const from = process.env.NEWSLETTER_FROM || DEFAULT_FROM;
  const replyTo = process.env.NEWSLETTER_REPLY_TO || "";

  for (const fileArg of args.files) {
    const resolvedPath = path.resolve(repoRoot, fileArg);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`File not found: ${fileArg}`);
      process.exit(1);
    }

    const markdown = fs.readFileSync(resolvedPath, "utf8");
    const meta = parsePostMeta(resolvedPath, markdown, siteUrl);
    const check = shouldSendPost(meta, { force: args.force });

    if (!check.ok) {
      console.log(`Skipping ${fileArg}: ${check.reason}`);
      continue;
    }

    const email = buildBroadcastEmail(meta, siteUrl);
    console.log(`Prepared broadcast for ${fileArg}`);
    console.log(`  Type:    ${meta.isDigest ? "digest" : "blog post"}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  URL:     ${meta.url}`);

    if (args.dryRun) {
      console.log("\n--- PLAIN TEXT PREVIEW ---\n" + email.text + "\n--------------------------\n");
      continue;
    }

    if (!apiKey || !segmentId) {
      const msg =
        "Missing RESEND_API_KEY or RESEND_SEGMENT_ID environment variables. Configure repository secrets before sending.";
      if (process.env.GITHUB_EVENT_NAME === "push") {
        console.warn(`::warning::${msg}`);
        continue;
      }
      console.error(msg);
      process.exit(1);
    }

    if (!args.skipWait && !args.draft) {
      await waitForUrl(meta.url);
    }

    const result = await sendResendBroadcast({
      apiKey,
      segmentId,
      from,
      replyTo,
      name: `${meta.dateIso}-${meta.slug}`,
      subject: email.subject,
      html: email.html,
      text: email.text,
      send: !args.draft,
    });

    console.log(
      `Resend broadcast ${args.draft ? "draft created" : "sent"}: id=${result.id || "unknown"}`
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
