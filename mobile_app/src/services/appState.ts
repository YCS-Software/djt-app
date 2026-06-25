/**
 * appState — durable app-shell state for Android process-death survival.
 *
 * Why: this is a Capacitor WebView app. On a low-memory process kill (or a cold
 * relaunch from Recents) the WebView is destroyed and reloaded at "/", so the
 * in-memory React Router stack, the visible screen, and any half-typed form are
 * lost. We persist the *intent* (last route + form drafts) so the app can put
 * the user back where they were.
 *
 * Storage strategy:
 *  - @capacitor/preferences = durable native key/value (survives WebView storage
 *    eviction; the real source of truth).
 *  - localStorage mirror = lets RootRedirect read the last route *synchronously*
 *    at boot with no flicker. App.tsx rehydrates the mirror from Preferences on
 *    startup so the sync read is reliable even if localStorage was cleared.
 */
import { Preferences } from '@capacitor/preferences';

const LAST_ROUTE_KEY = 'djt:lastRoute';
const DRAFT_PREFIX = 'djt:draft:';
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Routes we never restore to (they self-redirect or are pre-auth)
const NON_RESTORABLE = new Set(['/', '/login', '/signup']);

interface SavedRoute { path: string; ts: number; }

// ---- last route ------------------------------------------------------------

export async function saveLastRoute(path: string): Promise<void> {
  const payload = JSON.stringify({ path, ts: Date.now() } as SavedRoute);
  try { localStorage.setItem(LAST_ROUTE_KEY, payload); } catch { /* storage full/disabled */ }
  try { await Preferences.set({ key: LAST_ROUTE_KEY, value: payload }); } catch { /* native unavailable */ }
}

// Re-stamp the existing saved route (called on resume so a long background
// doesn't make an otherwise-valid route "too old" to restore).
export async function touchLastRoute(): Promise<void> {
  const saved = readLastRouteSync();
  if (saved) await saveLastRoute(saved.path);
}

export function readLastRouteSync(): SavedRoute | null {
  try {
    const raw = localStorage.getItem(LAST_ROUTE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.path !== 'string' || typeof o.ts !== 'number') return null;
    return o as SavedRoute;
  } catch {
    return null;
  }
}

export function clearLastRoute(): void {
  try { localStorage.removeItem(LAST_ROUTE_KEY); } catch { /* ignore */ }
  // fire-and-forget native removal
  Preferences.remove({ key: LAST_ROUTE_KEY }).catch(() => {});
}

// Copy the durable Preferences value into the localStorage mirror at boot, so
// the synchronous RootRedirect read works even after WebView storage eviction.
export async function hydrateLastRoute(): Promise<void> {
  try {
    if (localStorage.getItem(LAST_ROUTE_KEY)) return; // mirror already present
    const { value } = await Preferences.get({ key: LAST_ROUTE_KEY });
    if (value) localStorage.setItem(LAST_ROUTE_KEY, value);
  } catch {
    /* native unavailable (e.g. web) — sync read simply returns null */
  }
}

// The route to restore on a cold boot, or null to fall back to the role home.
export function getRestorableRoute(maxAgeMs: number = DEFAULT_MAX_AGE_MS): string | null {
  const saved = readLastRouteSync();
  if (!saved) return null;
  if (Date.now() - saved.ts > maxAgeMs) return null;
  if (typeof saved.path !== 'string' || !saved.path.startsWith('/')) return null;
  const base = saved.path.split('?')[0];
  if (NON_RESTORABLE.has(base)) return null;
  return saved.path;
}

// ---- form drafts -----------------------------------------------------------

export async function saveDraft(key: string, data: unknown): Promise<void> {
  try {
    await Preferences.set({ key: DRAFT_PREFIX + key, value: JSON.stringify({ data, ts: Date.now() }) });
  } catch { /* ignore */ }
}

export async function loadDraft<T>(key: string, maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key: DRAFT_PREFIX + key });
    if (!value) return null;
    const o = JSON.parse(value);
    if (!o || typeof o.ts !== 'number' || Date.now() - o.ts > maxAgeMs) return null;
    return o.data as T;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  try { await Preferences.remove({ key: DRAFT_PREFIX + key }); } catch { /* ignore */ }
}
