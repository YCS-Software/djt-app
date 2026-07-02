import { useNavigate, useLocation, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Toast } from "@capacitor/toast";
import routes from "./config";
import { saveLastRoute, touchLastRoute } from "../services/appState";
import { runBackHandlers } from "../services/backHandler";
import { authService } from "../services/api";
import { AUTH_EXPIRED_EVENT } from "../services/api/apiClient";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

// Routes that should never be persisted as the "last screen"
const NON_RESTORABLE = new Set(["/", "/login", "/signup"]);
// Top-level screens where Back should ask to exit rather than navigate away
const ROOT_ROUTES = new Set(["/", "/home", "/owner", "/login"]);

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });

  // Persist the current screen so a process-death relaunch can restore it (F1).
  useEffect(() => {
    if (!NON_RESTORABLE.has(location.pathname)) {
      saveLastRoute(location.pathname + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Keep the saved route "fresh" when the app returns to the foreground, so a
  // long background period doesn't age it past the restore window (F8).
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) touchLastRoute();
    }).then((h) => { handle = h; }).catch(() => {});
    return () => { handle?.remove(); };
  }, []);

  // Central session-expiry handling: when the API rejects our token (401/403),
  // clear the session and send the user to login once (F9).
  useEffect(() => {
    const onExpired = () => {
      authService.logout();
      if (window.location.pathname !== "/login") {
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hardware/gesture Back: let open overlays consume it first, then navigate
  // back; on a root screen, double-back-to-exit instead of an abrupt exit (F7).
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let lastBackAt = 0;

    CapacitorApp.addListener("backButton", () => {
      // 1) An open modal/scanner gets first chance to consume the press.
      if (runBackHandlers()) return;

      const path = window.location.pathname;
      // 2) Deep screen → go back within the app.
      if (!ROOT_ROUTES.has(path) && window.history.length > 1) {
        navigate(-1);
        return;
      }
      // 3) Root screen → confirm exit on a second press within 2s.
      const now = Date.now();
      if (now - lastBackAt < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackAt = now;
        Toast.show({ text: "Press back again to exit", duration: "short" }).catch(() => {});
      }
    }).then((h) => { handle = h; }).catch(() => {});

    return () => { handle?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return element;
}
