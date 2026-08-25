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
