// Thin wrapper around the Umami tracker loaded in index.html. The script is
// absent in dev builds and blocked by plenty of extensions, so every call has
// to survive `window.umami` being undefined — analytics must never take the
// presentation down with it.

declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, unknown>) => void;
    };
  }
}

export function track(name: string, data?: Record<string, unknown>) {
  try {
    window.umami?.track(name, data);
  } catch {
    // Swallow: a failed beacon is never worth surfacing to a presenter.
  }
}

// SHA-256 of raw bytes, hex-encoded. Lets events fingerprint content (e.g.
// tell a recompiled deck apart from an identical re-upload) without any file
// contents leaving the browser — only the digest itself is ever sent.
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
