/**
 * appVersion — server-controlled update check.
 *
 * On launch the app tells the server its build number and asks whether it is
 * still supported. The server (GET /app/version) compares it with one setting,
 * APP_MIN_VERSION_CODE, so an update can be made mandatory by changing that
 * value on the server — no app release needed.
 *
 * Outcomes:
 *   ok          – up to date, or the server has no opinion → app runs normally
 *   required    – this build is below the minimum → blocking "Update required"
 *   unreachable – the phone is online but our server did not answer → blocking
 *                 "Can't reach the server" screen with Retry + Update buttons
 *                 (this is what a build pointing at a retired server looks like)
 */
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { apiClient, ApiError } from './api/apiClient';
import { getOnline } from './connectivity';

export const DEFAULT_UPDATE_URL = 'https://play.google.com/store/apps/details?id=com.djthaika.ev';

export interface InstalledVersion {
  code: number;       // Android versionCode / iOS build number
  name: string;       // e.g. "2.0.16"
  platform: 'android' | 'ios';
}

export type UpdateStatus = 'ok' | 'required' | 'unreachable';

export interface UpdateCheck {
  status: UpdateStatus;
  installed: InstalledVersion;
  updateUrl: string;
}

interface VersionResponse {
  data: {
    min_version_code: number;
    update_required: boolean;
    update_url: string | null;
  };
}

/** The version of the build that is actually running. */
export async function getInstalledVersion(): Promise<InstalledVersion> {
  const platform: 'android' | 'ios' = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await CapApp.getInfo();
      const code = parseInt(info.build, 10);
      if (Number.isFinite(code) && code > 0) {
        return { code, name: info.version, platform };
      }
    } catch { /* plugin unavailable — fall through to the build-time value */ }
  }
  // Web / fallback: values baked in at build time from android/app/build.gradle.
  return { code: __APP_VERSION_CODE__, name: __APP_VERSION_NAME__, platform };
}

/** Ask the server whether this build is still supported. Never throws. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const installed = await getInstalledVersion();
  const base: UpdateCheck = {
    status: 'ok',
    installed,
    updateUrl: DEFAULT_UPDATE_URL,
  };

  try {
    const res = await apiClient.get<VersionResponse>(
      `/app/version?platform=${installed.platform}&version_code=${installed.code}`,
    );
    const d = res?.data;
    if (!d) return base;
    return {
      ...base,
      status: d.update_required ? 'required' : 'ok',
      updateUrl: d.update_url || DEFAULT_UPDATE_URL,
    };
  } catch (e) {
    const kind = e instanceof ApiError ? e.kind : 'network';
    // The server answered, just not with what we expected (e.g. an older server
    // without this endpoint returns 404). That is not a reason to block the app.
    if (kind === 'http' || kind === 'parse' || kind === 'auth') return base;
    // No reply at all. If the phone itself is offline the OfflineBanner already
    // explains it; only when the phone IS online is the server the problem.
    const online = await getOnline();
    return online ? { ...base, status: 'unreachable' } : base;
  }
}

/** Open the store page (or direct download link) outside the app. */
export function openUpdateUrl(url: string) {
  const target = url || DEFAULT_UPDATE_URL;
  try {
    // '_system' hands the link to the OS, so a Play Store link opens the Play
    // Store app instead of loading inside the WebView.
    const w = window.open(target, '_system');
    if (!w) window.location.href = target;
  } catch {
    window.location.href = target;
  }
}
