package fr.pfa.veille;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SessionExport")
public class SessionExportPlugin extends Plugin {
    @PluginMethod public void save(PluginCall call) {
        String name = call.getString("name");
        String mime = call.getString("mime");
        if (name == null || mime == null || call.getString("content") == null) {
            call.reject("Export incomplet"); return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "fileSelected");
    }
    @ActivityCallback private void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(); return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) { call.reject("Destination absente"); return; }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("Destination inaccessible");
            out.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (Exception e) { call.reject("Échec de l’export", e); }
    }
}
