const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export function normalizeEmail(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length > 3 &&
    email.length <= MAX_EMAIL_LENGTH &&
    EMAIL_REGEX.test(email)
  );
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret) {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createToken(email, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify({
    email: normalizeEmail(email),
    exp: nowSeconds + TOKEN_TTL_SECONDS,
  });
  const encoder = new TextEncoder();
  const payloadB64 = toBase64Url(encoder.encode(payload));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const encoder = new TextEncoder();
    const key = await importHmacKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadB64));
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(payloadJson);
    if (!payload || !isValidEmail(payload.email) || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < nowSeconds) {
      return null;
    }
    return payload.email;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || "https://nphard.io,https://www.nphard.io";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = parseAllowedOrigins(env);
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(body, status, corsHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildConfirmationEmail(confirmUrl, siteUrl) {
  const safeConfirmUrl = escapeHtml(confirmUrl);
  const safeSiteUrl = escapeHtml(siteUrl);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#eff1f5;color:#4c4f69;font-family:'Berkeley Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:14px;line-height:1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eff1f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #ccd0da;border-radius:6px;padding:28px;">
            <tr>
              <td>
                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;color:#4c4f69;">np &mdash; confirm your subscription</p>
                <p style="margin:0 0 20px;color:#5c5f77;">
                  Click the button below to confirm you'd like to receive new blog posts and digests from <a href="${safeSiteUrl}" style="color:#1e66f5;text-decoration:underline;">${safeSiteUrl.replace(/^https?:\/\//, "")}</a>.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${safeConfirmUrl}" style="display:inline-block;padding:10px 18px;background-color:#1e66f5;color:#eff1f5;text-decoration:none;border-radius:4px;font-weight:bold;">Confirm subscription</a>
                </p>
                <p style="margin:0 0 12px;font-size:12px;color:#6c6f85;">
                  Or paste this link into your browser:<br />
                  <a href="${safeConfirmUrl}" style="color:#1e66f5;word-break:break-all;">${safeConfirmUrl}</a>
                </p>
                <p style="margin:16px 0 0;font-size:12px;color:#8c8fa1;">
                  This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
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
    "np — confirm your subscription",
    "",
    `Confirm that you'd like to receive new blog posts and digests from ${siteUrl}:`,
    confirmUrl,
    "",
    "This link expires in 24 hours. If you didn't request this, you can ignore this email.",
  ].join("\n");

  return { html, text };
}

async function sendConfirmationEmail(env, email, confirmUrl, siteUrl, fetchImpl = fetch) {
  const { html, text } = buildConfirmationEmail(confirmUrl, siteUrl);
  const payload = {
    from: env.FROM_EMAIL,
    to: [email],
    subject: "Confirm your subscription to np",
    html,
    text,
  };
  if (env.REPLY_TO) {
    payload.reply_to = env.REPLY_TO;
  }

  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend /emails failed (${res.status}): ${errText}`);
  }
}

async function upsertResendSubscriber(env, email, fetchImpl = fetch) {
  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  const segmentId = env.RESEND_SEGMENT_ID;

  // Create the contact and assign to the newsletter segment.
  const createRes = await fetchImpl("https://api.resend.com/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    }),
  });

  if (createRes.status === 201) {
    return;
  }

  // If the contact already existed (200 upsert, 409 conflict, or 422 duplicate),
  // explicitly re-subscribe and attach to the segment so previously unsubscribed
  // users can opt back in cleanly.
  if (createRes.ok || createRes.status === 409 || createRes.status === 422) {
    const encodedEmail = encodeURIComponent(email);
    const patchRes = await fetchImpl(`https://api.resend.com/contacts/${encodedEmail}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ unsubscribed: false }),
    });
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      throw new Error(`Resend PATCH /contacts failed (${patchRes.status}): ${errText}`);
    }

    const segRes = await fetchImpl(
      `https://api.resend.com/contacts/${encodedEmail}/segments/${encodeURIComponent(segmentId)}`,
      {
        method: "POST",
        headers,
      }
    );
    if (!segRes.ok && segRes.status !== 409) {
      const errText = await segRes.text();
      throw new Error(`Resend add-to-segment failed (${segRes.status}): ${errText}`);
    }
    return;
  }

  const errText = await createRes.text();
  throw new Error(`Resend POST /contacts failed (${createRes.status}): ${errText}`);
}

async function parseRequestBody(request) {
  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }
  return null;
}

function wantsHtmlRedirect(request) {
  const accept = request.headers.get("Accept") || "";
  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  return !contentType.includes("application/json") && accept.includes("text/html");
}

async function handleSubscribe(request, env, fetchImpl) {
  const corsHeaders = getCorsHeaders(request, env);
  const siteUrl = (env.SITE_URL || "https://nphard.io").replace(/\/+$/, "");
  const redirectFallback = wantsHtmlRedirect(request);

  // Enforce Origin check when Origin header is present (browser requests).
  const origin = request.headers.get("Origin");
  if (origin && !corsHeaders["Access-Control-Allow-Origin"]) {
    return jsonResponse({ ok: false, error: "Origin not allowed." }, 403, corsHeaders);
  }

  const body = await parseRequestBody(request);
  if (!body || typeof body !== "object") {
    if (redirectFallback) {
      return Response.redirect(`${siteUrl}/subscribe/?status=error`, 303);
    }
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400, corsHeaders);
  }

  // Honeypot trap for bots: pretend everything succeeded.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    if (redirectFallback) {
      return Response.redirect(`${siteUrl}/subscribe/?status=check-inbox`, 303);
    }
    return jsonResponse(
      { ok: true, message: "Check your inbox to confirm your subscription." },
      200,
      corsHeaders
    );
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    if (redirectFallback) {
      return Response.redirect(`${siteUrl}/subscribe/?status=invalid-email`, 303);
    }
    return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400, corsHeaders);
  }

  if (!env.RESEND_API_KEY || !env.SIGNING_SECRET || !env.FROM_EMAIL) {
    console.error("Missing required Worker environment variables.");
    if (redirectFallback) {
      return Response.redirect(`${siteUrl}/subscribe/?status=error`, 303);
    }
    return jsonResponse({ ok: false, error: "Newsletter service is not configured." }, 500, corsHeaders);
  }

  try {
    const token = await createToken(email, env.SIGNING_SECRET);
    const workerOrigin = new URL(request.url).origin;
    const confirmUrl = `${workerOrigin}/confirm?token=${encodeURIComponent(token)}`;
    await sendConfirmationEmail(env, email, confirmUrl, siteUrl, fetchImpl);

    if (redirectFallback) {
      return Response.redirect(`${siteUrl}/subscribe/?status=check-inbox`, 303);
    }
    return jsonResponse(
      { ok: true, message: "Check your inbox to confirm your subscription." },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error("Subscribe error:", err);
    if (redirectFallback) {
      return Response.redirect(`${siteUrl}/subscribe/?status=error`, 303);
    }
    return jsonResponse(
      { ok: false, error: "Could not send confirmation email. Please try again later." },
      502,
      corsHeaders
    );
  }
}

async function handleConfirm(request, env, fetchImpl) {
  const siteUrl = (env.SITE_URL || "https://nphard.io").replace(/\/+$/, "");
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || !env.SIGNING_SECRET) {
    return Response.redirect(`${siteUrl}/subscribe/?status=invalid`, 302);
  }

  const email = await verifyToken(token, env.SIGNING_SECRET);
  if (!email) {
    return Response.redirect(`${siteUrl}/subscribe/?status=invalid`, 302);
  }

  try {
    await upsertResendSubscriber(env, email, fetchImpl);
    return Response.redirect(`${siteUrl}/subscribe/?status=confirmed`, 302);
  } catch (err) {
    console.error("Confirm error:", err);
    return Response.redirect(`${siteUrl}/subscribe/?status=error`, 302);
  }
}

export function createHandler(fetchImpl = fetch) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        const corsHeaders = getCorsHeaders(request, env);
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return jsonResponse({ ok: true }, 200);
      }

      if (url.pathname === "/subscribe" && request.method === "POST") {
        return handleSubscribe(request, env, fetchImpl);
      }

      if (url.pathname === "/confirm" && request.method === "GET") {
        return handleConfirm(request, env, fetchImpl);
      }

      return jsonResponse({ ok: false, error: "Not found." }, 404);
    },
  };
}

export default createHandler();
