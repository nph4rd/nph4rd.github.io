import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFrontMatter,
  parsePostMeta,
  shouldSendPost,
  buildBroadcastEmail,
  sendResendBroadcast,
} from "../send.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("parses all existing posts in _posts without error", () => {
  const postsDir = path.join(REPO_ROOT, "_posts");
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0);

  for (const file of files) {
    const fullPath = path.join(postsDir, file);
    const md = fs.readFileSync(fullPath, "utf8");
    const meta = parsePostMeta(fullPath, md, "https://nphard.io");
    const email = buildBroadcastEmail(meta, "https://nphard.io");

    assert.ok(meta.title.length > 0, `missing title for ${file}`);
    assert.match(meta.url, /^https:\/\/nphard\.io\/\d{4}\/\d{2}\/\d{2}\/.+\.html$/);
    assert.ok(email.html.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"), `missing unsubscribe in ${file}`);
    assert.ok(email.text.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"), `missing text unsubscribe in ${file}`);
  }
});

test("digest email renders full markdown content and absolutizes relative images", () => {
  const digestPath = path.join(REPO_ROOT, "_posts/2026-11-03-aug-oct-26-digest.md");
  const md = fs.readFileSync(digestPath, "utf8");
  const meta = parsePostMeta(digestPath, md, "https://nphard.io");
  assert.equal(meta.isDigest, true);

  const email = buildBroadcastEmail(meta, "https://nphard.io");
  assert.equal(email.subject, "[np digest] AUG-OCT 26");
  assert.ok(email.html.includes("https://nphard.io/images/triskelion.svg"));
  assert.ok(email.html.includes("https://nphard.io/images/kizhi-pogost.jpg"));
  assert.ok(email.html.includes("https://nphard.io/2026/11/03/aug-oct-26-digest.html"));
});

test("blog post email includes ASCII art, excerpt, and link without full 60KB body", () => {
  const postPath = path.join(REPO_ROOT, "_posts/2026-10-07-eleusinian-swarms.md");
  const md = fs.readFileSync(postPath, "utf8");
  const meta = parsePostMeta(postPath, md, "https://nphard.io");
  assert.equal(meta.isDigest, false);
  assert.equal(meta.publishNow, true);

  const email = buildBroadcastEmail(meta, "https://nphard.io");
  assert.equal(email.subject, "[np] ELEUSINIAN SWARMS");
  assert.ok(email.html.includes("Read the full post"));
  assert.ok(email.html.includes("https://nphard.io/2026/10/07/eleusinian-swarms.html"));
  assert.ok(email.html.length < 6000);
});

test("shouldSendPost respects newsletter: false and future dates", () => {
  const futureMd = `---\ntitle: Future Draft\ncategories: [AI]\n---\nHello`;
  const futureMeta = parsePostMeta("_posts/2099-01-01-draft.md", futureMd, "https://nphard.io");
  assert.equal(shouldSendPost(futureMeta, { now: new Date("2026-11-20T00:00:00Z") }).ok, false);
  assert.equal(
    shouldSendPost(futureMeta, { force: true, now: new Date("2026-11-20T00:00:00Z") }).ok,
    true
  );

  const publishNowMd = `---\ntitle: Early\npublish_now: true\n---\nHello`;
  const publishNowMeta = parsePostMeta(
    "_posts/2099-01-01-early.md",
    publishNowMd,
    "https://nphard.io"
  );
  assert.equal(
    shouldSendPost(publishNowMeta, { now: new Date("2026-11-20T00:00:00Z") }).ok,
    true
  );

  const optOutMd = `---\ntitle: Quiet\nnewsletter: false\n---\nHello`;
  const optOutMeta = parsePostMeta("_posts/2026-01-01-quiet.md", optOutMd, "https://nphard.io");
  assert.equal(shouldSendPost(optOutMeta, { force: true }).ok, false);
});

test("parseFrontMatter supports multi-line YAML arrays", () => {
  const { data } = parseFrontMatter(
    `---\ntitle: Test\ncategories:\n  - digest\n  - notes\n---\nBody`
  );
  assert.deepEqual(data.categories, ["digest", "notes"]);
});

test("sendResendBroadcast sends expected REST payload", async () => {
  let captured = null;
  const result = await sendResendBroadcast(
    {
      apiKey: "re_123",
      segmentId: "seg_abc",
      from: "np <newsletter@nphard.io>",
      name: "2026-11-03-aug-oct-26-digest",
      subject: "[np digest] AUG-OCT 26",
      html: "<p>Hi</p>",
      text: "Hi",
      send: true,
    },
    async (url, init) => {
      captured = { url, headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ id: "bc_999" }), { status: 200 });
    }
  );

  assert.equal(result.id, "bc_999");
  assert.equal(captured.url, "https://api.resend.com/broadcasts");
  assert.equal(captured.headers.Authorization, "Bearer re_123");
  assert.equal(captured.body.segment_id, "seg_abc");
  assert.equal(captured.body.send, true);
});
