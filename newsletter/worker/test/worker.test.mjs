import test from "node:test";
import assert from "node:assert/strict";
import { createHandler, createToken, verifyToken, isValidEmail } from "../src/index.js";

const ENV = {
  SITE_URL: "https://nphard.io",
  FROM_EMAIL: "np <newsletter@nphard.io>",
  ALLOWED_ORIGINS: "https://nphard.io,https://www.nphard.io",
  RESEND_API_KEY: "re_test_key",
  RESEND_SEGMENT_ID: "seg_123",
  SIGNING_SECRET: "super-secret-signing-key-for-tests",
};

test("email validation and HMAC token roundtrip", async () => {
  assert.equal(isValidEmail("friend@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);

  const now = 1_700_000_000;
  const token = await createToken("Friend@Example.com", ENV.SIGNING_SECRET, now);
  assert.equal(await verifyToken(token, ENV.SIGNING_SECRET, now + 60), "friend@example.com");
  assert.equal(await verifyToken(token, ENV.SIGNING_SECRET, now + 86401), null);
  assert.equal(await verifyToken(token + "x", ENV.SIGNING_SECRET, now + 60), null);
  assert.equal(await verifyToken(token, "wrong-secret", now + 60), null);
});

test("POST /subscribe sends double opt-in email via Resend", async () => {
  const calls = [];
  const mockFetch = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  };

  const handler = createHandler(mockFetch);
  const req = new Request("https://newsletter.nphard.io/subscribe", {
    method: "POST",
    headers: {
      Origin: "https://nphard.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "Alice@Example.com", website: "" }),
  });

  const res = await handler.fetch(req, ENV);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://nphard.io");
  const json = await res.json();
  assert.equal(json.ok, true);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.deepEqual(calls[0].body.to, ["alice@example.com"]);
  assert.match(calls[0].body.text, /https:\/\/newsletter\.nphard\.io\/confirm\?token=/);
});

test("POST /subscribe rejects disallowed origin and swallows honeypot bots", async () => {
  const calls = [];
  const handler = createHandler(async (url) => {
    calls.push(url);
    return new Response("{}", { status: 200 });
  });

  const badOrigin = await handler.fetch(
    new Request("https://newsletter.nphard.io/subscribe", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    }),
    ENV
  );
  assert.equal(badOrigin.status, 403);

  const bot = await handler.fetch(
    new Request("https://newsletter.nphard.io/subscribe", {
      method: "POST",
      headers: { Origin: "https://nphard.io", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bot@spam.com", website: "http://spam.example" }),
    }),
    ENV
  );
  assert.equal(bot.status, 200);
  assert.equal(calls.length, 0);
});

test("GET /confirm creates contact in Resend and redirects", async () => {
  const calls = [];
  const handler = createHandler(async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ id: "contact_1" }), { status: 201 });
  });

  const token = await createToken("friend@example.com", ENV.SIGNING_SECRET);
  const res = await handler.fetch(
    new Request(`https://newsletter.nphard.io/confirm?token=${encodeURIComponent(token)}`),
    ENV
  );

  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "https://nphard.io/subscribe/?status=confirmed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/contacts");
  assert.deepEqual(calls[0].body, {
    email: "friend@example.com",
    unsubscribed: false,
    segments: [{ id: "seg_123" }],
  });
});

test("GET /confirm re-subscribes an existing contact cleanly", async () => {
  const calls = [];
  const handler = createHandler(async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (url === "https://api.resend.com/contacts") {
      return new Response(JSON.stringify({ message: "Contact already exists" }), { status: 409 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  const token = await createToken("returning@example.com", ENV.SIGNING_SECRET);
  const res = await handler.fetch(
    new Request(`https://newsletter.nphard.io/confirm?token=${encodeURIComponent(token)}`),
    ENV
  );

  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "https://nphard.io/subscribe/?status=confirmed");
  assert.equal(calls.length, 3);
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].url, "https://api.resend.com/contacts/returning%40example.com");
  assert.deepEqual(calls[1].body, { unsubscribed: false });
  assert.equal(calls[2].method, "POST");
  assert.equal(
    calls[2].url,
    "https://api.resend.com/contacts/returning%40example.com/segments/seg_123"
  );
});

test("GET /confirm redirects to invalid status on tampered token", async () => {
  const handler = createHandler(async () => {
    throw new Error("should not call fetch");
  });

  const res = await handler.fetch(
    new Request("https://newsletter.nphard.io/confirm?token=bad.token"),
    ENV
  );
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "https://nphard.io/subscribe/?status=invalid");
});
