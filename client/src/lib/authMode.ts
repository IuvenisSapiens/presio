// Whether accounts / login are available at all in this build. Auth is backed
// by Supabase (GoTrue); the fully-local / offline build bakes in an empty
// VITE_SUPABASE_URL (see local.docker-compose.yml + supabaseClient.ts's
// placeholder fallback), so there is no auth provider to talk to.
//
// When auth is disabled we hide the login UI entirely — a login button that
// can only fail is worse than none — and unlock the features that were gated
// on login solely to attach an account. Drawing (strokes sync over Socket.IO,
// authorized by the controller token, not a session) and notes editing (a
// local session rewrites its PDF in IndexedDB) both work with no account, so
// there's nothing to sign in for.
export const authEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL);
