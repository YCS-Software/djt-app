/**
 * backHandler — a small stack so transient overlays (modals, the camera scanner)
 * can consume the Android hardware Back press before the app navigates (F7).
 *
 * The global listener (in AppRoutes) calls runBackHandlers() first; if a handler
 * returns true it "consumed" the press (e.g. closed a modal) and navigation is
 * skipped. Otherwise the app does router-back / double-back-to-exit.
 */
import { useEffect, useRef } from 'react';

type BackHandler = () => boolean;

const stack: BackHandler[] = [];

export function pushBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.indexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

// Run the most-recently-registered handlers first; stop at the first that handles it.
export function runBackHandlers(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    try {
      if (stack[i]()) return true;
    } catch {
      /* ignore a faulty handler */
    }
  }
  return false;
}

/**
 * Register a Back handler while `active` is true (e.g. while a modal is open).
 * The handler should close the overlay and return true.
 */
export function useBackHandler(active: boolean, handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => { ref.current(); return true; });
  }, [active]);
}
