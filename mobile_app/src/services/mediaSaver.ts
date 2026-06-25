/**
 * MediaSaver — bridge to the native MediaSaverPlugin (Android).
 * Saves an image into the public Downloads/DJT folder via MediaStore, which is
 * visible in the Files app and needs no runtime permission on Android 10+.
 * (Capacitor Filesystem can't target public folders on scoped storage — it
 * fails with EACCES — so we use this instead for real "downloads".)
 */
import { registerPlugin } from '@capacitor/core';

export interface MediaSaverPlugin {
  saveImage(options: { base64: string; filename: string; mimeType?: string }): Promise<{ path: string }>;
}

export const MediaSaver = registerPlugin<MediaSaverPlugin>('MediaSaver');
