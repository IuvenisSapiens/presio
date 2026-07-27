import type express from "express";

// A fixed public origin, when the deployment knows one. Derived once at startup
// so a malformed value fails loudly here rather than silently per request.
const configured = (() => {
  const raw = process.env.PUBLIC_BASE_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    console.error(`Ignoring malformed PUBLIC_BASE_URL: ${raw}`);
    return "";
  }
})();

/**
 * Absolute origin to use in generated links (canonical/og:url tags, handoff
 * URLs, agent-doc and OpenAPI self-references).
 *
 * Prefers PUBLIC_BASE_URL. Without it we fall back to the request's own
 * protocol + Host header, which the client controls: a spoofed Host poisons
 * canonical tags and hands `/api/present` callers a handoff link pointing at
 * someone else's origin. That fallback is still the right default for local /
 * LAN use, where the server is legitimately reached as localhost, a LAN IP, or
 * a hostname that isn't knowable at startup — so set PUBLIC_BASE_URL on any
 * deployment served from a known domain.
 */
export function baseUrl(req: express.Request): string {
  return configured || `${req.protocol}://${req.get("host")}`;
}
