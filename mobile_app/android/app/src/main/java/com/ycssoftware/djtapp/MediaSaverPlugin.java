package com.ycssoftware.djtapp;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * MediaSaver — saves a base64 image into the device's public Downloads folder
 * so it's visible in the Files app / Downloads, with NO runtime permission on
 * Android 10+ (uses MediaStore). On Android 9 and below it falls back to the
 * legacy public Downloads path.
 *
 * Exposed to JS as `MediaSaver.saveImage({ base64, filename, mimeType })`.
 * This exists because Capacitor's Filesystem writes raw java.io.File paths,
 * which fail with EACCES on scoped storage when targeting public folders.
 */
@CapacitorPlugin(name = "MediaSaver")
public class MediaSaverPlugin extends Plugin {

    private static final String SUBDIR = "DJT"; // Downloads/DJT

    @PluginMethod
    public void saveImage(PluginCall call) {
        String base64 = call.getString("base64");
        String filename = call.getString("filename", "download.png");
        String mimeType = call.getString("mimeType", "image/png");

        if (base64 == null || base64.isEmpty()) {
            call.reject("base64 is required");
            return;
        }

        try {
            // strip a possible "data:...;base64," prefix
            int comma = base64.indexOf(',');
            if (base64.startsWith("data:") && comma >= 0) {
                base64 = base64.substring(comma + 1);
            }
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);

            String savedPath;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ : MediaStore Downloads — no permission needed
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + SUBDIR);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Could not create the download entry");
                    return;
                }
                try (OutputStream os = resolver.openOutputStream(uri)) {
                    if (os == null) {
                        call.reject("Could not open the download for writing");
                        return;
                    }
                    os.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                savedPath = "Downloads/" + SUBDIR + "/" + filename;
            } else {
                // Android 9 and below : legacy public Downloads path
                File dir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    SUBDIR
                );
                if (!dir.exists()) dir.mkdirs();
                File outFile = new File(dir, filename);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(bytes);
                }
                savedPath = outFile.getAbsolutePath();
            }

            JSObject ret = new JSObject();
            ret.put("path", savedPath);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage(), e);
        }
    }
}
